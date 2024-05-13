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

const _ = require('lodash');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const region = process.env.AWS_REGION || 'us-east-1';
const qnabot = require('qnabot/logging');
const util = require('./util');
const jwt = require('./jwt');
const customSdkConfig = require('sdk-config/customSdkConfig');

async function get_userInfo(userId, idattrs, userPrefs = undefined) {
    const default_userInfo = {
        UserId: userId,
        InteractionCount: 1,
    };
    const usersTable = process.env.DYNAMODB_USERSTABLE;
    const docClient = DynamoDBDocument.from(new DynamoDB(customSdkConfig('C013', { apiVersion: '2012-08-10', region })));
    const params = {
        TableName: usersTable,
        Key: {
            UserId: userId,
        },
    };
    qnabot.log('Getting user info for user: ', userId, 'from DynamoDB table: ', usersTable);
    let ddbResponse = {};
    try {
        ddbResponse = await docClient.get(params);
    } catch (e) {
        qnabot.log('DDB Exception caught.. can\'t retrieve userInfo: ', e);
    }
    qnabot.log('DDB Response: ', ddbResponse);
    const req_userInfo = _.get(ddbResponse, 'Item', default_userInfo);
    // append user identity attributes if known
    if (_.get(idattrs, 'preferred_username')) {
        _.set(req_userInfo, 'preferred_username', _.get(idattrs, 'preferred_username'));
    }
    if (_.get(idattrs, 'cognito:username')) {
        _.set(req_userInfo, 'UserName', _.get(idattrs, 'cognito:username'));
    }
    if (_.get(idattrs, 'given_name')) {
        _.set(req_userInfo, 'GivenName', _.get(idattrs, 'given_name'));
    }
    if (_.get(idattrs, 'family_name')) {
        _.set(req_userInfo, 'FamilyName', _.get(idattrs, 'family_name'));
    }
    if (_.get(idattrs, 'email')) {
        _.set(req_userInfo, 'Email', _.get(idattrs, 'email'));
    }
    if (_.get(idattrs, 'verifiedIdentity')) {
        _.set(req_userInfo, 'isVerifiedIdentity', _.get(idattrs, 'verifiedIdentity'));
    }
    if (_.get(idattrs, 'profile')) {
        _.set(req_userInfo, 'Profile', _.get(idattrs, 'profile'));
    }
    // add session attributes userPrefs to user profile
    if (userPrefs) {
        _.set(req_userInfo, 'userPrefs', userPrefs);
    }
    // append time since last seen
    const now = new Date();
    const lastSeen = Date.parse(req_userInfo.LastSeen || '1970/1/1 12:00:00');
    const timeSinceLastInteraction = Math.abs(now - lastSeen) / 1000; // seconds
    _.set(req_userInfo, 'TimeSinceLastInteraction', timeSinceLastInteraction);
    return req_userInfo;
}

async function update_userInfo(userId, req_userInfo, ttlDays) {
    const res_userInfo = _.cloneDeep(req_userInfo);
    const dt = new Date();
    res_userInfo.FirstSeen = req_userInfo.FirstSeen || dt.toString();
    res_userInfo.LastSeen = dt.toString();
    res_userInfo.InteractionCount = req_userInfo.InteractionCount + 1;
    // set userInfo record TTL
    if (ttlDays > 0) {
        const secondsPerDay = 24 * 60 * 60;
        const ttlDate = new Date(dt.getTime() + ttlDays * secondsPerDay * 1000);
        res_userInfo.ttl = Math.floor(ttlDate.getTime() / 1000);
    }
    return res_userInfo;
}

async function runPreProcessLambda(req, res) {
    const prehook = _.get(req, '_settings.LAMBDA_PREPROCESS_HOOK', undefined) || process.env.LAMBDA_PREPROCESS;
    if (prehook) {
        const arn = util.getLambdaArn(prehook);
        try {
            const result = await util.invokeLambda({
                FunctionName: arn,
                req,
                res,
            });

            req = result.req;
            res = result.res;
        } catch (e) {
            qnabot.log(`Error invoking pre-processing lambda: ${arn}`);
            qnabot.log(JSON.stringify(e));
        }
    }
    return { req, res };
}

async function decodeSessionToken(req) {
    const idtoken = _.get(req, 'session.idtokenjwt');
    let idattrs = { verifiedIdentity: 'false' };
    if (!idtoken) {
        return idattrs;
    }

    const decoded = jwt.decode(idtoken);

    if (!decoded) {
        qnabot.log('Invalid idtokenjwt - cannot decode');
        return idattrs;
    }

    idattrs = _.get(decoded, 'payload');
    qnabot.log('Decoded idtoken:', idattrs);
    const kid = _.get(decoded, 'header.kid');
    const default_jwks_url = [_.get(req, '_settings.DEFAULT_USER_POOL_JWKS_URL')];
    let identity_provider_jwks_url = _.get(req, '_settings.IDENTITY_PROVIDER_JWKS_URLS');
    if (identity_provider_jwks_url && identity_provider_jwks_url.length) {
        try {
            identity_provider_jwks_url = JSON.parse(identity_provider_jwks_url);
        } catch (err) {
            qnabot.warn(err);
        }
    }
    const urls = default_jwks_url.concat(identity_provider_jwks_url);
    qnabot.log('Attempt to verify idtoken using jwks urls:', urls);
    const verified_url = await jwt.verify(idtoken, kid, urls);
    if (verified_url) {
        _.set(idattrs, 'verifiedIdentity', 'true');
        qnabot.log('Verified identity with:', verified_url);
    } else {
        _.set(idattrs, 'verifiedIdentity', 'false');
        qnabot.log('Unable to verify identity for any configured IdP jwks urls');
    }

    return idattrs;
}

async function replaceQuestionIfPiiDetected(req) {
    qnabot.log('Checking for PII');
    const foundPii = await qnabot.isPIIDetected(
        req.question,
        true,
        _.get(req, '_settings.PII_REJECTION_REGEX', ''),
        _.get(req, '_settings.PII_REJECTION_ENTITY_TYPES', ''),
        _.get(req, '_settings.PII_REJECTION_CONFIDENCE_SCORE', 0.99),
    );
    if (_.get(req, '_settings.PII_REJECTION_QUESTION') && foundPii) {
        qnabot.log('Found PII or REGEX Match - setting question to PII_REJECTION_QUESTION');
        return _.get(req, '_settings.PII_REJECTION_QUESTION');
    }

    return req.question;
}

module.exports = async function preprocess(req, res) {
    _.set(req, '_fulfillment.step', 'preprocess');

    ({ req, res } = await runPreProcessLambda(req, res));

    _.set(req, '_fulfillment.step', undefined);

    const idattrs = await decodeSessionToken(req);

    // Do we need to enforce authentication?
    if (_.get(req, '_settings.ENFORCE_VERIFIED_IDENTITY') && _.get(idattrs, 'verifiedIdentity', 'false') !== 'true') {
        // identity is not verified
        // reset question to the configured no_verified_identity question
        qnabot.log('Missing or invalid idtokenjwt - ENFORCE_VERIFIED_IDENTITY is true - setting question to NO_VERIFIED_IDENTITY_QUESTION');
        req.question = _.get(req, '_settings.NO_VERIFIED_IDENTITY_QUESTION', 'no_verified_identity');
    }

    if (_.get(req, '_settings.ENABLE_REDACTING_WITH_COMPREHEND')) {
        qnabot.log('Looking for PII using Comprehend');
        await qnabot.setPIIRedactionEnvironmentVars(
            req.question,
            _.get(req, '_settings.ENABLE_REDACTING_WITH_COMPREHEND', false),
            _.get(req, '_settings.REDACTING_REGEX', ''),
            _.get(req, '_settings.COMPREHEND_REDACTING_ENTITY_TYPES', ''),
            _.get(req, '_settings.COMPREHEND_REDACTING_CONFIDENCE_SCORE', 0.99),
        );
    }

    if (_.get(req, '_settings.PII_REJECTION_ENABLED')) {
        req.question = await replaceQuestionIfPiiDetected(req);
    }

    // Add _userInfo to req, from UsersTable
    // NOSONAR TODO Will need to rework logic if/when we link userid across clients (SMS,WebUI,Alexa)
    qnabot.log('userid found', idattrs['cognito:username'], idattrs.verifiedIdentity);
    const userId = idattrs['cognito:username'] && idattrs.verifiedIdentity == 'true' ? idattrs['cognito:username'] : req._userId;
    let userPrefs = _.get(req, 'session.userPrefs');

    if (_.get(req, '_settings.SAVE_CLIENT_USERPREFS', 'false') === 'true' && JSON.stringify(userPrefs).length > 2048) {
        userPrefs = undefined;
        qnabot.log('WARNING: The userPrefs session attribute can not be more than 2048 bytes -- NOT SAVING');
    }

    const req_userInfo = await get_userInfo(userId, idattrs, userPrefs);
    // UserInfo might already be set by preprocessing hook. If it is combine it with what we get from DDB
    const userInfo = _.get(req, '_userInfo', {});
    Object.assign(req_userInfo, userInfo);
    _.set(req, '_userInfo', req_userInfo);
    // set the userPrefs session attribute to the value returned from DDB
    _.set(req, 'session.userPrefs', _.get(req_userInfo, 'userPrefs', {}));
    // Add _userInfo to res, with updated timestamps
    // May be further modified by lambda hooks
    // Will be saved back to DynamoDB in userInfo.js
    const ttlDays = _.get(req, '_settings.USERINFO_TTL_DAYS', 0)
    const res_userInfo = await update_userInfo(userId, req_userInfo, ttlDays);
    _.set(res, '_userInfo', res_userInfo);

    if (_.get(req, '_settings.REMOVE_ID_TOKENS_FROM_SESSION', false)) {
        qnabot.log('Removing id tokens from session event: idtokenjwt, accesstokenjwt, refreshtoken');
        delete req.session.idtokenjwt;
        delete req.session.accesstokenjwt;
        delete req.session.refreshtoken;
        delete res.session.idtokenjwt;
        delete res.session.accesstokenjwt;
        delete res.session.refreshtoken;
        // Lex
        if (req._type == 'LEX' && _.get(req, '_event.sessionAttributes')) {
            delete req._event.sessionAttributes.idtokenjwt;
            delete req._event.sessionAttributes.accesstokenjwt;
            delete req._event.sessionAttributes.refreshtoken;
        }
        if (req._type == 'ALEXA' && _.get(req, '_event.session.attributes')) {
            delete req._event.session.attributes.idtokenjwt;
            delete req._event.session.attributes.accesstokenjwt;
            delete req._event.session.attributes.refreshtoken;
        }
    }

    _.set(req, '_info.es.address', process.env.ES_ADDRESS);
    _.set(req, '_info.es.index', process.env.ES_INDEX);
    _.set(req, '_info.es.type', process.env.ES_TYPE);
    _.set(req, '_info.es.service.qid', process.env.ES_SERVICE_QID);
    _.set(req, '_info.es.service.proxy', process.env.ES_SERVICE_PROXY);
    return { req, res };
};
