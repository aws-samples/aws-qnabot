/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

/**
 *
 * Lex Bot Router. Given the name of a bot, Call bot using $LATEST and pass input text.
 * Handle response from Lex Bot and update session attributes as needed.
 */
const _ = require('lodash');
const { LexRuntimeV2 } = require('@aws-sdk/client-lex-runtime-v2');
const customSdkConfig = require('sdk-config/customSdkConfig');
const region = process.env.AWS_REGION || 'us-east-1';

const FREE_TEXT_ELICIT_RESPONSE_NAME = 'QNAFreeText';
const QNANumber = 'QNANumber';
const QNAWage = 'QNAWage';
const QNASocialSecurity = 'QNASocialSecurity';
const QNAPin = 'QNAPin';
const QNADate = 'QNADate';
const QNADateNoConfirm = 'QNADateNoConfirm';
const QNADayOfWeek = 'QNADayOfWeek';
const QNAMonth = 'QNAMonth';
const QNAAge = 'QNAAge';
const QNAAgeNoConfirm = 'QNAAgeNoConfirm';
const QNAPhoneNumber = 'QNAPhoneNumber';
const QNAPhoneNumberNoConfirm = 'QNAPhoneNumberNoConfirm';
const QNATime = 'QNATime';
const QNAEmailAddress = 'QNAEmailAddress';
const QNAName = 'QNAName';
const QNAYesNo = 'QNAYesNo';
const QNAYesNoExit = 'QNAYesNoExit';
const qnabot = require('qnabot/logging');

const {get_userLanguages , get_translation} = require('./multilanguage.js');
const helper = require('../../../../../../../../../../opt/lib/supportedLanguages');
const {batchTagTranslation} = require('./specialtyBotRouter.js');


function isConnectClient(req) {
    return !!_.get(req, '_event.requestAttributes.x-amz-lex:accept-content-types', undefined);
}

async function translate_res(req, res) {
    const locale = _.get(req, 'session.qnabotcontext.userLocale');

    const nativeLanguage = _.get(req._settings, 'NATIVE_LANGUAGE', 'English');
    const languageMapper = helper.getSupportedLanguages();
    const nativeLanguageCode = languageMapper[nativeLanguage];

    if (_.get(req._settings, 'ENABLE_MULTI_LANGUAGE_SUPPORT') && res.message) {
        // get the language of the response
        let responseLang = await get_userLanguages(res.message);
        let responseLangCode = responseLang.Languages[0].LanguageCode;
        qnabot.log('response language is ', responseLangCode);

        // if the response language is the same as the Native Language, return the response without translating
        if (responseLangCode == nativeLanguageCode) {
            return res;
        }

        qnabot.log('We need to translate the response since the native language in the deployment is different from the language that the user is communicating with');

        if (_.get(res, 'message')) {
            res.message = await batchTagTranslation(res, responseLangCode, locale, req);
        }
        if (_.get(res, 'plainMessage')) {
            res.plainMessage = await get_translation(res.plainMessage, responseLangCode, locale, req);
        }
        if (_.get(res, 'card')) {
            res.card.title = await get_translation(res.card.title, responseLangCode, locale, req);
        }
        if (_.get(res, 'card.buttons')) {
            res.card.buttons.forEach(async (button) => {
                button.text = await get_translation(button.text, responseLangCode, locale, req);
                // NOSONAR TODO Address multilanguage issues with translating button values for use in confirmation prompts
                // Disable translate of button value
                // button.value = await translate.translateText(button.value,'en',locale);
            });
            res.plainMessage = await get_translation(res.plainMessage, responseLangCode, locale, req);
        }
    }
    return res;
}

/**
 * Call recognizeText and use promise to return data response.
 * @param lexClient
 * @param params
 * @returns {*}
 */
function lexV2ClientRequester(params) {
    const lexV2Client = new LexRuntimeV2(customSdkConfig('C002', { region }));
    return new Promise((resolve, reject) => {
        lexV2Client.recognizeText(params, (err, data) => {
            if (err) {
                qnabot.log(err, err.stack);
                reject(`Lex client request error:${err}`);
            } else {
                qnabot.log(`Lex client response:${JSON.stringify(data, null, 2)}`);
                resolve(data);
            }
        });
    });
}

function mapFromSimpleName(botName) {
    const bName = process.env[botName];
    return bName || botName;
}

function getFreeTextResponse(inputText, sentiment, sentimentScore) {
    const response = {
        message: '',
        slots: {
            FreeText: inputText,
            Sentiment: sentiment,
            SentimentPositive: _.get(sentimentScore, 'Positive', ''),
            SentimentNegative: _.get(sentimentScore, 'Negative', ''),
            SentimentNeutral: _.get(sentimentScore, 'Neutral', ''),
            SentimentMixed: _.get(sentimentScore, 'Mixed', ''),
        },
        dialogState: 'Fulfilled',
    };
    return response;
}

function getRespText(req, botName) {
    // if a connect client and an elicitResponse bot such as QNANumber and the user is confirming the response
    // from the bot, proxy a key pad press (phone touch) of 1 for Yes and 2 for No. This helps accessibility
    // when confirming responses to a Lex intent.
    let respText = _.get(req, 'question');
    const progress = _.get(req, 'session.qnabotcontext.elicitResponse.progress', undefined);
    if (isConnectClientConfirmIntent(req, botName, progress)) {
        if (respText === '1' || respText.toLowerCase() === 'one' || respText.toLowerCase() === 'correct') respText = 'Yes';
        if (respText === '2' || respText.toLowerCase() === 'two') respText = 'No';
    }
    if (isPhoneNumber(botName, progress)) {
        respText = `my number is ${respText}`;
    }
    if (isDate(botName, progress)) {
        respText = `the date is ${respText}`;
    }
    return respText;
}

function isDate(botName, progress) {
    return (botName === QNADate || botName === QNADateNoConfirm) && (progress === 'ElicitSlot' || progress === 'ElicitIntent' || progress === '' || progress === undefined);
}

function isPhoneNumber(botName, progress) {
    return (botName === QNAPhoneNumber || botName === QNAPhoneNumberNoConfirm) && (progress === 'ElicitSlot' || progress === 'ElicitIntent' || progress === '' || progress === undefined);
}

function isConnectClientConfirmIntent(req, botName, progress) {
    return isConnectClient(req) && (botName != QNAYesNo && botName != QNAYesNoExit) && progress === 'ConfirmIntent';
}

/**
 * Setup call to Lex including user ID, input text, botName, botAlis. It is an async function and
 * will return the response form Lex.
 * @param req
 * @param res
 * @param botName
 * @param botAlias
 * @returns {Promise<*>}
 */
async function handleRequest(req, res, botName, botAlias) {
    let tempBotUserID = _.get(req, '_userInfo.UserId', 'nouser');
    tempBotUserID = tempBotUserID.substring(0, 100); // Lex has max userId length of 100
    tempBotUserID = tempBotUserID.replaceAll(/[^a-zA-Z0-9\-._:]/g,'_'); // NOSONAR - javascript:S5852 - input is user controlled and we have a limit on the number of characters 

    if (botName === FREE_TEXT_ELICIT_RESPONSE_NAME) {
        return getFreeTextResponse(_.get(req, 'question'), _.get(req, 'sentiment'), _.get(req, 'sentimentScore'));
    }

    const respText = getRespText(req, botName);

    // Resolve bot details from environment, if using simple name for built-in bots
    const botIdentity = mapFromSimpleName(botName);

    const response = {};
    // Lex V2 response bot
    const ids = botIdentity.split('::')[1];
    let [botId, botAliasId, localeId] = ids.split('/');
    localeId = localeId || 'en_US';
    const params = {
        botId,
        botAliasId,
        localeId,
        sessionId: tempBotUserID,
        text: respText,

    };
    qnabot.log(`Lex V2 parameters: ${JSON.stringify(params)}`);
    const lexv2response = await lexV2ClientRequester(params);
    qnabot.log(`Lex V2 response: ${JSON.stringify(lexv2response)}`);
    response.message = _.get(lexv2response, 'messages[0].content', '');
    response.messages = {}
    for (const message of _.get(lexv2response, 'messages', [])) {
        response.messages[message.contentType] = message.content
    }


    // lex v2 FallbackIntent match means it failed to fill desired slot(s).
    if (lexv2response.sessionState.intent.name === 'FallbackIntent'
            || lexv2response.sessionState.intent.state === 'Failed') {
        response.dialogState = 'Failed';
    } else {
        response.dialogState = lexv2response.sessionState.dialogAction.type;
    }
    const slots = _.get(lexv2response, 'sessionState.intent.slots');
    if (slots) {
        response.slots = _.mapValues(slots, (x) => _.get(x, 'value.interpretedValue'));
    }
    return response;
}

function indicateFailure(req, res, errmsg) {
    const namespace = _.get(res, 'session.qnabotcontext.elicitResponse.namespace', undefined);
    if (namespace) {
        _.set(res.session, `${namespace}.boterror`, 'true');
    }
    _.set(res, 'session.qnabotcontext.elicitResponse.progress', 'Failed');
    _.set(res, 'session.qnabotcontext.elicitResponse.responsebot', undefined);
    _.set(res, 'session.qnabotcontext.elicitResponse.namespace', undefined);
    _.set(res, 'session.qnabotcontext.elicitResponse.loopCount', 0);
    res.card = undefined;

    const chainingConfig = _.get(res, 'session.qnabotcontext.elicitResponse.chainingConfig', undefined);
    if (chainingConfig === undefined) {
        res.message = errmsg;
        res.plainMessage = errmsg;
    }
}

/**
 * Main processing logic to handle request from 3_query.js and process response from Lex. Handles
 * dialogState response from Lex.
 * @param req
 * @param res
 * @param hook
 * @returns {Promise<{}>}
 */
async function processResponse(req, res, hook, msg) {
    const maxElicitResponseLoopCount = _.get(req, '_settings.ELICIT_RESPONSE_MAX_RETRIES', 5);
    const elicit_Response_Retry_Message = _.get(req, '_settings.ELICIT_RESPONSE_RETRY_MESSAGE', 'Please try again.');

    const botResp = await handleRequest(req, res, hook, 'live');
    qnabot.log(`botResp: ${JSON.stringify(botResp, null, 2)}`);
    let plainMessage = _.get(botResp, 'messages.PlainText', '');
    let ssmlMessage = _.get(botResp, 'messages.SSML', '');
    let elicitResponseLoopCount = _.get(res, 'session.qnabotcontext.elicitResponse.loopCount', 0);

    switch (botResp.dialogState) {
    case 'ConfirmIntent':
        _.set(res, 'session.qnabotcontext.elicitResponse.progress', 'ConfirmIntent');
        res.plainMessage = plainMessage;
        // if SSML tags were present and client supports SSML then build SSML response
        if (ssmlMessage && req._preferredResponseType == 'SSML') {
            res.type = 'SSML';
            res.message = ssmlMessage;
        } else {
            res.message = plainMessage;
        }

        res.card = {
            send: true,
            title: 'Info',
            buttons: [
                {
                    text: 'Yes',
                    value: 'Yes',
                },
                {
                    text: 'No',
                    value: 'No',
                },
            ],
        };
        break;
    case 'Failed':
        _.set(res, 'session.qnabotcontext.elicitResponse.loopCount', ++elicitResponseLoopCount);
        if (elicitResponseLoopCount >= maxElicitResponseLoopCount) {
            indicateFailure(req, res, _.get(req, '_settings.ELICIT_RESPONSE_BOT_FAILURE_MESSAGE', 'Your response was not understood. Please start again.'));
        } else {
            _.set(res, 'session.qnabotcontext.elicitResponse.progress', 'ErrorHandling');
            res.message = elicit_Response_Retry_Message;
            res.plainMessage = elicit_Response_Retry_Message;
            res.card = undefined;
        }
        break;
    case 'ElicitIntent':
    case 'ElicitSlot':
        _.set(res, 'session.qnabotcontext.elicitResponse.progress', botResp.dialogState);
        res.message = botResp.message || elicit_Response_Retry_Message;
        res.plainMessage = res.message;
        res.card = undefined;
        break;
    case 'Fulfilled':
    case 'ReadyForFulfillment':
    case 'Close':
        res.message = botResp.message || undefined;
        res.plainMessage = res.message;
        _.set(res, 'session.qnabotcontext.elicitResponse.progress', botResp.dialogState);
        _.set(res.session, res.session.qnabotcontext.elicitResponse.namespace, botResp.slots);
        _.set(res, 'session.qnabotcontext.elicitResponse.responsebot', undefined);
        _.set(res, 'session.qnabotcontext.elicitResponse.namespace', undefined);
        break;
    default:
        res.message = botResp.message || elicit_Response_Retry_Message;
        res.plainMessage = res.message;
        _.set(res, 'session.qnabotcontext.elicitResponse.progress', botResp.dialogState);
    }

    // as much as we'd like to return an empty message, QnABot semantics requires some message to
    // be returned.
    res.message = res.message ? res.message : _.get(req, '_settings.ELICIT_RESPONSE_DEFAULT_MSG', 'Ok. ');
    res.plainMessage = res.plainMessage ? res.plainMessage : _.get(req, '_settings.ELICIT_RESPONSE_DEFAULT_MSG', 'Ok. ');

    // autotranslate res fields
    res = await translate_res(req, res);

    // set res.session.qnabot_gotanswer
    _.set(res, 'session.qnabot_gotanswer', true);

    const resp = {};
    resp.req = req;
    resp.res = res;
    return resp;
}

exports.elicitResponse = processResponse;
