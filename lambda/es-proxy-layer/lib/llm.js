/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                               *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/* eslint-disable max-len, no-underscore-dangle */
const _ = require('lodash');
const { Lambda } = require('@aws-sdk/client-lambda');
const { SageMakerRuntime } = require('@aws-sdk/client-sagemaker-runtime');
const customSdkConfig = require('../lib/util/customSdkConfig');
const qnabot = require('qnabot/logging');
const region = process.env.AWS_REGION || 'us-east-1';

const { ChatMessageHistory, BufferMemory } = require('langchain/memory');
const { PromptTemplate } = require('langchain/prompts');
const { TokenTextSplitter } = require('langchain/text_splitter');
const { get_encoding } = require('@dqbd/tiktoken');

//
// Private functions
//

const default_params_stg = '{"temperature":0}';

function countTokens(message) {
    const encoder = get_encoding('gpt2');

    const tokens = encoder.encode(message);
    encoder.free();
    return tokens.length;
}

async function truncateByNumTokens(message, chunkSize) {
    const splitter = new TokenTextSplitter({
        encodingName: 'gpt2',
        chunkSize,
        chunkOverlap: 0,
    });

    const output = await splitter.createDocuments([message]);
    qnabot.log(output);
    qnabot.log(output[0].pageContent);
    return output[0].pageContent;
}

async function createTruncatedPrompt(promptTemplateStr, promptTemplate, history, context, input, query, maxLength) {
    const prompt = await promptTemplate.format({
        history,
        context,
        input,
        query,
    });

    const promptTokenCount = countTokens(prompt);
    if (maxLength && promptTokenCount > maxLength) {
        qnabot.log(
            `Prompt token count is ${promptTokenCount}, which is more than the setting limit: ${maxLength}. Truncating...`,
        );
        const diff = promptTokenCount - maxLength;

        const historyTokenCount = promptTemplateStr.includes('{history}') ? countTokens(history) : 0;
        if (historyTokenCount > diff) {
            const truncatedHistory = await truncateByNumTokens(history, historyTokenCount - diff);
            qnabot.log(`Selectively truncating history. New history: ${truncatedHistory}`);
            return promptTemplate.format({
                history: truncatedHistory,
                context,
                input,
                query,
            });
        }
        qnabot.log(`Selectively removing history from prompt, since it is ${historyTokenCount} tokens long.`);

        const contextTokenCount = promptTemplateStr.includes('{context}') ? countTokens(context) : 0;
        if (historyTokenCount + contextTokenCount > diff) {
            const truncatedContext = await truncateByNumTokens(context, contextTokenCount - diff - historyTokenCount);
            qnabot.log(`Selectively truncating context. New context: ${truncatedContext}`);
            return promptTemplate.format({
                history: '',
                context: truncatedContext,
                input,
                query,
            });
        }

        throw new Error(
            `Unable to truncate prompt to be less than ${maxLength} tokens long. Please check your prompt template and settings.`,
        );
    }

    return prompt;
}

// make QA prompt from template
async function make_qa_prompt(req, promptTemplateStr, context, input, query) {
    const chatMessageHistory = await chatMemoryParse(
        _.get(req._userInfo, 'chatMessageHistory', '[]'),
        req._settings.LLM_CHAT_HISTORY_MAX_MESSAGES,
    );
    const memory = new BufferMemory({ chatHistory: chatMessageHistory });
    const { history } = await memory.loadMemoryVariables();
    const promptTemplate = new PromptTemplate({
        template: promptTemplateStr,
        inputVariables: ['history', 'context', 'input', 'query'],
    });
    const maxLength = parseInt(req._settings.LLM_PROMPT_MAX_TOKEN_LIMIT, 10);
    const prompt = await createTruncatedPrompt(
        promptTemplateStr,
        promptTemplate,
        history,
        context,
        input,
        query,
        maxLength,
    );

    return [memory, history, promptTemplate, prompt];
}
// make generate query prompt from template
async function make_qenerate_query_prompt(req, promptTemplateStr) {
    const chatMessageHistory = await chatMemoryParse(
        _.get(req._userInfo, 'chatMessageHistory', '[]'),
        req._settings.LLM_CHAT_HISTORY_MAX_MESSAGES,
    );
    const memory = new BufferMemory({ chatHistory: chatMessageHistory });
    const { history } = await memory.loadMemoryVariables();
    const promptTemplate = new PromptTemplate({
        template: promptTemplateStr,
        inputVariables: ['history', 'input'],
    });
    const maxLength = req._settings.LLM_PROMPT_MAX_TOKEN_LIMIT;
    const prompt = await createTruncatedPrompt(
        promptTemplateStr,
        promptTemplate,
        history,
        '',
        req.question,
        '',
        maxLength,
    );

    return [memory, history, promptTemplate, prompt];
}

// Invoke LLM via SageMaker endpoint running HF_MODEL tiiuae/falcon-40b-instruct
async function invoke_sagemaker(prompt, model_params) {
    const sm = new SageMakerRuntime(customSdkConfig('C005', { region }));
    const body = JSON.stringify({
        inputs: prompt,
        parameters: model_params,
    });
    let response;
    qnabot.log(`Invoking SageMaker endpoint: ${process.env.LLM_SAGEMAKERENDPOINT}`);
    try {
        const smres = await sm
            .invokeEndpoint({
                EndpointName: process.env.LLM_SAGEMAKERENDPOINT,
                ContentType: 'application/json',
                Body: body,
            });
        const sm_body = JSON.parse(Buffer.from(smres.Body, 'utf-8').toString());
        qnabot.log('SM response body:', sm_body);
        response = sm_body[0].generated_text;
    } catch (e) {
        qnabot.warn('EXCEPTION:', e.stack);
        throw new Error(`Sagemaker exception: ${e.message.substring(0, 500)}...`);
    }
    return response;
}

async function generate_query_sagemaker(req, promptTemplateStr) {
    const model_params = JSON.parse(req._settings.LLM_GENERATE_QUERY_MODEL_PARAMS || default_params_stg);
    const [, , , prompt] = await make_qenerate_query_prompt(req, promptTemplateStr);
    qnabot.log(`Prompt: \nGENERATE QUERY PROMPT==>\n${prompt}\n<==PROMPT`);
    return invoke_sagemaker(prompt, model_params);
}
async function get_qa_sagemaker(req, promptTemplateStr, context) {
    const model_params = JSON.parse(req._settings.LLM_QA_MODEL_PARAMS || default_params_stg);
    const input = get_question(req);
    const query = get_query(req);
    const [, , , prompt] = await make_qa_prompt(req, promptTemplateStr, context, input, query);
    qnabot.log(`QUESTION ANSWERING PROMPT: \nPROMPT==>\n${prompt}\n<==PROMPT`);
    return invoke_sagemaker(prompt, model_params);
}

// Invoke LLM via custom Lambda abstraction
async function invoke_lambda(prompt, model_params, settings, sessionId, sessionState) {
    const lambda = new Lambda(customSdkConfig('C006', { region }));
    const body = JSON.stringify({
        prompt,
        parameters: model_params,
        settings,
        sessionId,
        sessionState,
    });

    qnabot.log(`Invoking Lambda: ${process.env.LLM_LAMBDA_ARN}`);
    try {
        const lambdares = await lambda
            .invoke({
                FunctionName: process.env.LLM_LAMBDA_ARN,
                InvocationType: 'RequestResponse',
                Payload: body,
            });

        const payloadObj = Buffer.from(lambdares.Payload).toString();
        const payload = JSON.parse(payloadObj);
        qnabot.log('Lambda response payload:', payload);
        if (payload.generated_text) {
            return payload.generated_text;
        }

        qnabot.warn("ERROR: Lambda response error. Returned payload missing 'generated_text' property:", payload);
        if (payload.errorMessage) {
            throw new Error(payload.errorMessage);
        }
        throw new Error('LLM inference failed.');
    } catch (e) {
        qnabot.warn('EXCEPTION:', e.stack);
        throw new Error(`Lambda exception: ${e.message.substring(0, 500)}...`);
    }
}
async function generate_query_lambda(req, promptTemplateStr) {
    const model_params = JSON.parse(req._settings.LLM_GENERATE_QUERY_MODEL_PARAMS || default_params_stg);
    const settings = req._settings;
    const [, , , prompt] = await make_qenerate_query_prompt(req, promptTemplateStr);
    qnabot.log(`Prompt: \nGENERATE QUERY PROMPT==>\n${prompt}\n<==PROMPT`);

    // Extract sessionId and sessionState from the request
    const sessionId = req._event.sessionId;
    const sessionState = req._event.sessionState;
    return invoke_lambda(prompt, model_params, settings, sessionId, sessionState);
}
async function get_qa_lambda(req, promptTemplateStr, context) {
    const model_params = JSON.parse(req._settings.LLM_QA_MODEL_PARAMS || default_params_stg);
    const settings = req._settings;
    // parse and serialise chat history to manage max messages
    const input = get_question(req);
    const query = get_query(req);
    const [, , , prompt] = await make_qa_prompt(req, promptTemplateStr, context, input, query);
    qnabot.log(`QUESTION ANSWERING PROMPT: \nPROMPT==>\n${prompt}\n<==PROMPT`);

    // Extract sessionId and sessionState from the request
    const sessionId = req._event.sessionId;
    const sessionState = req._event.sessionState;
    return invoke_lambda(prompt, model_params, settings, sessionId, sessionState);
}

function clean_standalone_query(query) {
    let clean_query = query;
    // remove preamble, if any
    clean_query = clean_query.replace(/^Here .*? the standalone question.*$/gim, '');
    // remove newlines
    clean_query = clean_query.replace(/\n/g, ' ');
    // No more than 1000 characters - for Kendra query compatibility - https://docs.aws.amazon.com/kendra/latest/dg/API_Query.html
    clean_query = clean_query.slice(0, 1000);
    // limit output to one question.. truncate any runaway answers that shouldn't be included in the query.
    const q_pos = clean_query.indexOf('?');
    if (q_pos > -1) {
        clean_query = clean_query.slice(0, q_pos + 1);
    }
    // trim leading or trailing whitespace
    clean_query = clean_query.trim();
    return clean_query;
}

//
// Exported functions
//

// clean unwanted text artifacts from the provided context..
const clean_context = function clean_context(context, req) {
    let clean_context = context;
    // remove URLS from Kendra passages
    clean_context = clean_context.replace(/^\s*Source Link:.*$/gm, ''); // NOSONAR - javascript:S5852 - input is user controlled and we have a limit on the number of characters
    // remove Kendra prefix messages
    if (req._settings.ALT_SEARCH_KENDRA_ANSWER_MESSAGE) {
        clean_context = clean_context.replace(new RegExp(req._settings.ALT_SEARCH_KENDRA_ANSWER_MESSAGE, 'g'), '');
    }
    if (req._settings.ALT_SEARCH_KENDRA_FAQ_MESSAGE) {
        clean_context = clean_context.replace(new RegExp(req._settings.ALT_SEARCH_KENDRA_FAQ_MESSAGE, 'g'), '');
    }
    if (req._settings.ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE) {
        clean_context = clean_context.replace(new RegExp(req._settings.ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE, 'g'), '');
    }
    return clean_context;
};

// LangChain chatMessageHistory serialize (to JSON) and parse (from JSON)
// Chat history persistance is maintained via userInfo, managed from query.js, and stored in DynamoDB with other userInfo.
async function chatMemorySerialise(chatMessageHistory, max = 50, human_prefix = 'Human', ai_prefix = 'AI') {
    const messages = await chatMessageHistory.getMessages();
    const obj_messages = [];
    for (const m of messages) {
        let role;
        if (m._getType() === 'human') {
            role = human_prefix;
        } else if (m._getType() === 'ai') {
            role = ai_prefix;
        } else {
            throw new Error(`Got unsupported message type: ${m}`);
        }
        obj_messages.push({ [role]: m.text });
    }
    return JSON.stringify(obj_messages.slice(-max));
}
async function chatMemoryParse(json_messages, max = 50) {
    const chatMessageHistory = new ChatMessageHistory();
    const obj_messages = JSON.parse(json_messages).slice(-max);
    qnabot.log(`Chat Message History (capped at ${max}): `, json_messages);
    for (const m of obj_messages) {
        if (m.Human) {
            chatMessageHistory.addUserMessage(m.Human);
        } else if (m.AI) {
            chatMessageHistory.addAIChatMessage(m.AI);
        } else {
            throw new Error(`Got unsupported message type: ${m}`);
        }
    }
    return chatMessageHistory;
}

// return the question to use in the QA prompt
function get_question(req) {
    const question = _.get(req, 'llm_generated_query.orig', req.question);
    return question;
}
function get_query(req) {
    const query = _.get(req, 'llm_generated_query.result', req.question);
    return query;
}

// generate_query: re-write utterance using chat history if needed, to make it standalone from prior conversation context.
const generate_query = async function generate_query(req) {
    qnabot.log(
        `Use LLM (${req._settings.LLM_API}) to convert a follow up question to a standalone search query containing required context from chat history`
    );
    const origQuestion = req.question;
    // NOSONAR TODO - Can this also tell me if a query is needed, or if the LLM/chatHistory already has the answer
    let promptTemplateStr =
        req._settings.LLM_GENERATE_QUERY_PROMPT_TEMPLATE ||
        '<br><br>Human: Given the following conversation and a follow up input, if the follow up input is a question please rephrase that question to be a standalone question, otherwise return the input unchanged.<br><br>Chat History:<br>{history}<br><br>Follow Up Input: {input}<br><br>Assistant:';
    promptTemplateStr = promptTemplateStr.replace(/<br>/gm, '\n');
    let newQuery;
    const start = Date.now();
    if (req._settings.LLM_API === 'SAGEMAKER') {
        // NOSONAR TODO refactor when langchainJS supports Sagemaker
        newQuery = await generate_query_sagemaker(req, promptTemplateStr);
    } else if (req._settings.LLM_API === 'LAMBDA') {
        newQuery = await generate_query_lambda(req, promptTemplateStr);
    } else {
        throw new Error(`Error: Unsupported LLM_API type: ${req._settings.LLM_API}`);
    }
    const end = Date.now();
    const timing = `${end - start} ms`;
    qnabot.debug(`LLM response before running clean_standalone_query(): ${newQuery}`);
    newQuery = clean_standalone_query(newQuery);
    const concatQuery = `${origQuestion} / ${newQuery}`;
    qnabot.log(
        `Original question: ${origQuestion} => New question: ${newQuery}. Use concatenation for retrieval query: ${concatQuery}`
    );
    req.question = concatQuery;
    req.llm_generated_query = {
        orig: origQuestion,
        result: newQuery,
        concatenated: concatQuery,
        timing
    };
    return req;
};

const get_qa = async function get_qa(req, context) {
    qnabot.log(
        `LLM (${req._settings.LLM_API}) Retrieval Augmented Generation (RAG) to answer user's question from search result context.`
    );
    let promptTemplateStr =
        req._settings.LLM_QA_PROMPT_TEMPLATE ||
        '<br><br>Human: You are an AI chatbot. Carefully read the following context and conversation history and then provide a short answer to question at the end. If the answer cannot be determined from the history or the context, reply saying "Sorry, I don\'t know". <br><br>Context: {context}<br><br>History: <br>{history}<br><br>Human: {input}<br><br>Assistant:';
    promptTemplateStr = promptTemplateStr.replace(/<br>/gm, '\n');
    context = clean_context(context, req);
    let answer;
    if (req._settings.LLM_API == 'SAGEMAKER') {
        // NOSONAR TODO refactor when langchainJS supports Sagemaker
        answer = await get_qa_sagemaker(req, promptTemplateStr, context);
    } else if (req._settings.LLM_API == 'LAMBDA') {
        answer = await get_qa_lambda(req, promptTemplateStr, context);
    } else {
        throw new Error(`Error: Unsupported LLM_API type: ${req._settings.LLM_API}`);
    }
    qnabot.log(`Question: ${req.question}`);
    qnabot.log(`Context: ${context}`);
    qnabot.log(`Answer: ${answer}`);
    return answer;
};

module.exports = {
    clean_context,
    chatMemorySerialise,
    chatMemoryParse,
    get_question,
    generate_query,
    get_qa
};
