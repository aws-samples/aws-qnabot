/** *******************************************************************************************************************
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
 ******************************************************************************************************************** */

const default_settings = {
    ENABLE_DEBUG_RESPONSES: 'false', // Determines whethere to log original English responses and translated responses for debugging
    ENABLE_DEBUG_LOGGING: 'false',
    NATIVE_LANGUAGE: '${Language}', // Native Language is the Language chosen during a deployment which will be the core language used for the OpenSearch analyzers. NOTE: This language should only be changed from the Stack
    ES_USE_KEYWORD_FILTERS: '${ES_USE_KEYWORD_FILTERS}', // Determines whether to detect keywords from Comprehend when searching for answers. Defaults to TRUE when not using Embeddings, and FALSE if using Embeddings.
    ES_EXPAND_CONTRACTIONS: '{"you\'re":"you are","I\'m":"I am","can\'t":"cannot"}',
    ES_KEYWORD_SYNTAX_TYPES: 'NOUN,PROPN,VERB,INTJ', // Comprehend will return these parts of speech found by Amazon Comprehend
    ES_SYNTAX_CONFIDENCE_LIMIT: .20, //  Comprehend makes a best effort to determine the parts of speech  in a sentence. The keywords will only be used if the confidence limit is greater than this amount
    ES_MINIMUM_SHOULD_MATCH: '2<75%', // Refer to https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-minimum-should-match.html for more information
    ES_NO_HITS_QUESTION: 'no_hits', // The QID of the question when no answers could be found for a user's question
    ES_ERROR_QUESTION: 'error_msg', // The QID of the question when no answers could be found for a user's question due to an error
    ES_USE_FUZZY_MATCH: 'false', // Refer to https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-fuzzy-query.html
    ES_PHRASE_BOOST: 4,
    ES_SCORE_ANSWER_FIELD: 'false', // If no 'qna' answer meets the score threshold, then query the answer field of qna items
    ES_SCORE_TEXT_ITEM_PASSAGES: 'true', // If no 'qna' answer meets the score threshold, then query the text field of 'text' items
    ENABLE_SENTIMENT_SUPPORT: 'true', // Determines whether to use Comprehend for sentiment analysis.  Refer to https://docs.aws.amazon.com/comprehend/latest/dg/how-sentiment.html
    ENABLE_MULTI_LANGUAGE_SUPPORT: 'false', // User can override and set to true to Enable Multilanguage support
    ENABLE_CUSTOM_TERMINOLOGY: 'false',
    MINIMUM_CONFIDENCE_SCORE: 0.6, // User can override this value to set the minimum confidence they accept using CustomQnABotSettings
    ALT_SEARCH_KENDRA_FALLBACK_CONFIDENCE_SCORE: 'HIGH', // Should be one of 'VERY_HIGH'|'HIGH'|'MEDIUM'|'LOW'
    ALT_SEARCH_KENDRA_FAQ_CONFIDENCE_SCORE: 'HIGH', // Should be one of 'VERY_HIGH'|'HIGH'|'MEDIUM'|'LOW'
    ALT_SEARCH_KENDRA_INDEXES: '${DefaultKendraIndexId}', // Add Kendra index to array to enable Amazon Kendra as a fallback source of answers
    ALT_SEARCH_KENDRA_S3_SIGNED_URLS: 'true', // If S3 document URL is in the search result, convert to signed URL. Please ensure IAM FulfillmentLambdaRole has access to S3 objects in Kendra index (default role grants access to buckets starting with name QNA or qna).
    ALT_SEARCH_KENDRA_S3_SIGNED_URL_EXPIRE_SECS: 300, // Expiry time for signed URLs
    ALT_SEARCH_KENDRA_MAX_DOCUMENT_COUNT: 2, // limit number of document search results returned by Kendra fallback\
    ALT_SEARCH_KENDRA_TOP_ANSWER_MESSAGE: 'Amazon Kendra suggested answer.',
    ALT_SEARCH_KENDRA_FAQ_MESSAGE: 'Answer from Amazon Kendra FAQ.',
    ALT_SEARCH_KENDRA_ANSWER_MESSAGE:
        'While I did not find an exact answer, these search results from Amazon Kendra might be helpful.', // Message displayed when a search comes from Kemdra
    ALT_SEARCH_KENDRA_RESPONSE_TYPES: 'ANSWER,DOCUMENT,QUESTION_ANSWER',
    ALT_SEARCH_KENDRA_ABBREVIATE_MESSAGE_FOR_SSML: 'true',
    KENDRA_FAQ_INDEX: '${DefaultKendraIndexId}', // Kendra Index specific for FAQ for if Kendra FAQ sync is enabled
    KENDRA_FAQ_CONFIG_MAX_RETRIES: 8, // User can override number of max retries in AWS SDK configurations
    KENDRA_FAQ_CONFIG_RETRY_DELAY: 600, // User can override number of miliseconds delay between retries in AWS SDK configurations
    KENDRA_FAQ_ES_FALLBACK: 'true', // Optional ElasticSearch Fallback engine for if KendraFAQ fails
    ENABLE_KENDRA_WEB_INDEXER: 'false', // Enables web crawler -- indexes pages specified by KENDRA_INDEXER_URLS
    KENDRA_INDEXER_URLS: '', // comma separated list of urls for Kendra to crawler
    KENDRA_INDEXER_CRAWL_DEPTH: 3,
    KENDRA_INDEXER_CRAWL_MODE: 'SUBDOMAINS', // Should be one of 'HOST_ONLY'|'SUBDOMAINS'|'EVERYTHING'
    KENDRA_INDEXER_SCHEDULE: 'rate(1 day)', // See https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html for valid expressions
    KENDRA_WEB_PAGE_INDEX: '${DefaultKendraIndexId}', // The index to use for the web crawler, a custom data source will automatically be added to the specified index.  The index will automatically be added to ALT_SEARCH_KENDRA_INDEXES
    KENDRA_INDEXED_DOCUMENTS_LANGUAGES: 'en', // Comma separated language list, Eg: "en,es,fr". Should be one of supported Kendra languages mentioned in https://docs.aws.amazon.com/kendra/latest/dg/in-adding-languages.html
    ERRORMESSAGE: 'Unfortunately I encountered an error when searching for your answer. Please ask me again later.',
    EMPTYMESSAGE: 'You stumped me! Sadly I do not know how to answer your question.',
    DEFAULT_ALEXA_LAUNCH_MESSAGE: 'Hello, Please ask a question',
    DEFAULT_ALEXA_REPROMPT:
        'Please either answer the question, ask another question or say Goodbye to end the conversation.',
    DEFAULT_ALEXA_STOP_MESSAGE: 'Goodbye',
    SMS_HINT_REMINDER_ENABLE: 'true',
    SMS_HINT_REMINDER: ' (Feedback? Reply THUMBS UP or THUMBS DOWN. Ask HELP ME at any time)',
    SMS_HINT_REMINDER_INTERVAL_HRS: 24,
    IDENTITY_PROVIDER_JWKS_URLS: [], // User can override this empty list to add trusted IdPs (eg from Lex-Web-UI)
    ENFORCE_VERIFIED_IDENTITY: 'false', // set to true to make QnABot require verified identity from client
    NO_VERIFIED_IDENTITY_QUESTION: 'no_verified_identity', // if user identity cannot be verified, replace question string with this.
    ELICIT_RESPONSE_MAX_RETRIES: 3, // Number of times an elicitResponse LexBot can be called before giving up when the Bot returns Failed
    ELICIT_RESPONSE_RETRY_MESSAGE: 'Please try again.', // Default retry message when working with LexBot
    ELICIT_RESPONSE_BOT_FAILURE_MESSAGE: 'Your response was not understood. Please start again.', // Message used when maximum number of retries is exceeded
    ELICIT_RESPONSE_DEFAULT_MSG: 'Ok. ', // Ok. with an intentional blank space after the period
    CONNECT_IGNORE_WORDS: '', // Throw an error if the transcript provided by connect only contains the words in this list (case insensitive)
    CONNECT_ENABLE_VOICE_RESPONSE_INTERRUPT: 'false', // Return bot response in session attribute to enable contact flow to use response as an interruptible prompt.
    CONNECT_NEXT_PROMPT_VARNAME: 'connect_nextPrompt', // Name of session var to use for next prompt
    ENABLE_REDACTING: 'false', // Enable the system to redact log output
    REDACTING_REGEX: '\\b\\d{4}\\b(?![-])|\\b\\d{9}\\b|\\b\\d{3}-\\d{2}-\\d{4}\\b', // default regex to use for redacting - redacts 4 digit numbers not followed by a '-', 9 digit numbers (SSN with no '-'s), and Standard SSN format
    ENABLE_REDACTING_WITH_COMPREHEND: 'false', // Enables redaction of PII using Comprehend
    COMPREHEND_REDACTING_CONFIDENCE_SCORE: 0.99, // Only redact PII if the score is above the configured percentage
    COMPREHEND_REDACTING_ENTITY_TYPES:
        'ADDRESS,EMAIL,SSN,PHONE,PASSWORD,BANK_ACCOUNT_NUMBER,BANK_ROUTING,CREDIT_DEBIT_NUMBER', // See https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/ for valid types
    PII_REJECTION_ENABLED: false, // Enables PII Rejection
    PII_REJECTION_QUESTION: 'pii_rejection_question', // If PII is found, the user's request (question) will change to this phrase
    PII_REJECTION_REGEX: '\\b\\d{4}\\b(?![-])|\\b\\d{9}\\b|\\b\\d{3}-\\d{2}-\\d{4}\\b', // Regex to use to find PII.,
    PII_REJECTION_ENTITY_TYPES: 'ADDRESS,EMAIL,SSN,PHONE,PASSWORD,BANK_ACCOUNT_NUMBER,BANK_ROUTING,CREDIT_DEBIT_NUMBER', // See https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/ for valid types
    PII_REJECTION_CONFIDENCE_SCORE: 0.99,
    DISABLE_CLOUDWATCH_LOGGING: 'false', // disable all logging in fulfillment es query handler lambda. does not disable logging from Lambda Hooks or Conditional Chaining Lambda functions
    MINIMAL_ES_LOGGING: 'false', // do not log utterances or session attributes to elasticsearch for kibana logging
    S3_PUT_REQUEST_ENCRYPTION: '', // enable header x-amz-server-side-encryption header and set with this value
    BOT_ROUTER_WELCOME_BACK_MSG: 'Welcome back to QnABot.', // The text used by QnABot when ending communication from a specialty bot
    BOT_ROUTER_EXIT_MSGS: 'exit,quit,goodbye,leave', // The exit phrases in comma separated list available for the a user to end communication with a specialty bot
    RUN_LAMBDAHOOK_FROM_QUERY_STEP: 'true',
    LAMBDA_PREPROCESS_HOOK: '',
    LAMBDA_POSTPROCESS_HOOK: '',
    SEARCH_REPLACE_QUESTION_SUBSTRINGS: '',
    PROTECTED_UTTERANCES: 'help,help me,thumbs up,thumbs down,repeat,no_hits,no_verified_identity,reset language,detect language,english,french,spanish,german,italian,chinese,arabic,greek,repeat,can you repeat that,can you please say that again,please repeat that', // Input Phrases that will not be treated as a question by the bot
    EMBEDDINGS_ENABLE: '${EMBEDDINGS_ENABLE}', // Set to TRUE or FALSE to enable or disable use of embeddings for semantic search
    EMBEDDINGS_SCORE_THRESHOLD: 0.85, // If embedding similarity score is under threshold the match is rejected and QnABot reverts to scoring answer field (if ES_SCORE_ANSWER_FIELD is true).
    EMBEDDINGS_SCORE_ANSWER_THRESHOLD: 0.8, // Applies only when if ES_SCORE_ANSWER_FIELD is true. If embedding similarity score on answer field is under threshold the match is rejected.
    EMBEDDINGS_TEXT_PASSAGE_SCORE_THRESHOLD: 0.8, // Applies only when if ES_SCORE_TEXT_ITEM_PASSAGES is true. If embedding similarity score on text item field is under threshold the match is rejected.
    LLM_API: '${LLMApi}',
    LLM_GENERATE_QUERY_ENABLE: '${LLM_GENERATE_QUERY_ENABLE}',
    LLM_GENERATE_QUERY_PROMPT_TEMPLATE: '${LLM_GENERATE_QUERY_PROMPT_TEMPLATE}',
    LLM_GENERATE_QUERY_MODEL_PARAMS: '${LLM_GENERATE_QUERY_MODEL_PARAMS}',
    LLM_QA_ENABLE: '${LLM_QA_ENABLE}', // Set to true or false to enable or disable SAGEMAKER summarization
    LLM_QA_USE_KENDRA_RETRIEVAL_API: '${LLM_QA_ENABLE}',
    LLM_QA_PROMPT_TEMPLATE: '${LLM_QA_PROMPT_TEMPLATE}',
    LLM_QA_MODEL_PARAMS: '${LLM_QA_MODEL_PARAMS}',
    LLM_QA_PREFIX_MESSAGE: 'LLM Answer:',
    LLM_QA_SHOW_CONTEXT_TEXT: 'true',
    LLM_QA_SHOW_SOURCE_LINKS: 'true',
    LLM_CHAT_HISTORY_MAX_MESSAGES: 12,
    LLM_QA_NO_HITS_REGEX:
        'Sorry,  //remove comment to enable custom no match (no_hits) when LLM does not know the answer.',
    LLM_PROMPT_MAX_TOKEN_LIMIT: '${LLM_PROMPT_MAX_TOKEN_LIMIT}',
    USERINFO_TTL_DAYS: 0, // Set to 0 to disable setting a ttl property in DyanmoDB
};

const defaultGenerateQueryPromptTemplate = 'Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.<br>Chat History: <br>{history}<br>Follow Up Input: {input}<br>Standalone question:';
const defaultQAPromptTemplate = 'Use the following pieces of context to answer the question at the end. If you don\'t know the answer, just say that you don\'t know, don\'t try to make up an answer. Write the answer in up to 5 complete sentences.<br><br>{context}<br><br>Question: {query}<br>Helpful Answer:';
const defaultModelParams = '{\\"temperature\\":0.01, \\"return_full_text\\":false, \\"max_new_tokens\\": 150}';

module.exports = {
    DefaultUserPoolJwksUrl: {
        Type: 'AWS::SSM::Parameter',
        Properties: {
            Description: 'Default QnABot Setting - DO NOT MODIFY',
            Type: 'String',
            Value: {
                'Fn::Join': [
                    '',
                    [
                        'https://cognito-idp.',
                        { Ref: 'AWS::Region' },
                        '.amazonaws.com/',
                        { Ref: 'UserPool' },
                        '/.well-known/jwks.json',
                    ],
                ],
            },
        },
    },
    DefaultQnABotSettings: {
        Type: 'AWS::SSM::Parameter',
        Properties: {
            Description: 'Default QnABot Settings - DO NOT MODIFY',
            Type: 'String',
            Tier: 'Advanced', // Advanced tier required to accomadate number of settings
            Value: {
                'Fn::Sub': [
                    JSON.stringify(default_settings),
                    {
                        ES_USE_KEYWORD_FILTERS: { 'Fn::If': ['EmbeddingsEnable', 'false', 'true'] },
                        EMBEDDINGS_ENABLE: { 'Fn::If': ['EmbeddingsEnable', 'true', 'false'] },
                        LLM_GENERATE_QUERY_ENABLE: { 'Fn::If': ['LLMEnable', 'true', 'false'] },
                        LLM_QA_ENABLE: { 'Fn::If': ['LLMEnable', 'true', 'false'] },
                        LLM_GENERATE_QUERY_PROMPT_TEMPLATE: defaultGenerateQueryPromptTemplate,
                        LLM_QA_PROMPT_TEMPLATE: defaultQAPromptTemplate,
                        LLM_GENERATE_QUERY_MODEL_PARAMS: defaultModelParams,
                        LLM_QA_MODEL_PARAMS: defaultModelParams,
                        LLM_PROMPT_MAX_TOKEN_LIMIT: { 'Fn::If': ['LLMSagemaker', 800, ''] },
                    },
                ],
            },
        },
    },
    CustomQnABotSettings: {
        Type: 'AWS::SSM::Parameter',
        Properties: {
            Description: 'Custom QnABot Settings - Modify to override defaults, or to add new settings',
            Type: 'String',
            Value: '{}',
        },
    },
};
