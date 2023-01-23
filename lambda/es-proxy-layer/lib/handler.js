const Url=require('url');
const Promise=require('bluebird');
const request=require('./request');
const _=require('lodash');
const build_es_query=require('./esbodybuilder');
const hits_topic_tiebreaker=require('./hits_topic_tiebreaker')
const kendra = require('./kendraQuery');
const qnabot = require("qnabot/logging")
const qna_settings = require("qnabot/settings")
const open_es = require("./es_query")
const get_embeddings = require('./embeddings');

async function get_settings() {
    let settings = await qna_settings.merge_default_and_custom_settings();
    qnabot.log("Merged Settings: ", settings);
    return settings;
}

// add embeddings for each QID in an add or modify item PUT query
async function build_additem_embeddings(event, settings) {
    if (settings.EMBEDDINGS_ENABLE == false) {
        console.log("EMBEDDINGS_ENABLE is false - query not modified");
        return event.body;
    }
    // question embeddings
    const questions = _.get(event,"body.questions",[]);
    var questions_with_embeddings = await Promise.all(questions.map(async x => {
        const q_embeddings = await get_embeddings(x.q, settings);
        return {
            q: x.q,
            q_vector: q_embeddings,
        }
    }));
    event.body.questions = questions_with_embeddings;
    // answer embeddings
    const answer = _.get(event,"body.a");
    if (answer) {
        event.body.a_vector = await get_embeddings(answer, settings);
    }
    return event.body;
}

async function get_es_query(event, settings) {
    let question = _.get(event,'question','');
    let size = _.get(event,'size',1);
    if (question.length > 0) {
        if (open_es.isQuestionAllStopwords(question)) {
            qnabot.log(`Question '${question}' contains only stop words. Forcing no hits.`);
            size = 0;
        }
        var query_params = {
            question: question,
            topic: _.get(event,'topic',''),
            from: _.get(event,'from',0),
            size: size,
            minimum_should_match: _.get(settings,'ES_MINIMUM_SHOULD_MATCH'),
            phrase_boost: _.get(settings, 'ES_PHRASE_BOOST'),
            use_keyword_filters: _.get(settings,'ES_USE_KEYWORD_FILTERS'),
            keyword_syntax_types: _.get(settings,'ES_KEYWORD_SYNTAX_TYPES'),
            syntax_confidence_limit: _.get(settings,'ES_SYNTAX_CONFIDENCE_LIMIT'),
            score_answer_field: _.get(settings,'ES_SCORE_ANSWER_FIELD'),
            fuzziness: _.get(settings, 'ES_USE_FUZZY_MATCH'),
            es_expand_contractions: _.get(settings,"ES_EXPAND_CONTRACTIONS"),
            settings: settings
        };
        return build_es_query(query_params);
    } else if (_.get(event,'method','') === 'PUT') {
        // add or modify item query - add embeddings for questions list, if enabled
        return await build_additem_embeddings(event, settings);
    } else {
        // use query as-is
        return Promise.resolve(event.body);
    }
}



async function run_query_es(event, settings) {
    var es_query = await get_es_query(event, settings);
    var es_response = await request({
        url:Url.resolve("https://"+event.endpoint,event.path),
        method:event.method,
        headers:event.headers,
        body:es_query,
    });
    if (_.get(es_response, "hits.max_score") == 0) {
        qnabot.log("Max score is zero - no valid results")
        es_response.hits.hits = [] ;
    }
    // apply topic tiebreaker to any equally ranked hits
    if (es_response.hits.hits && es_response.hits.hits.length) {
        const newhits = hits_topic_tiebreaker(query_params.topic, es_response.hits.hits);
        es_response.hits.hits = newhits;
    }
    return es_response;
}


async function run_query_kendra(event, kendra_index) {
    qnabot.log("Kendra FAQ Query index:" + kendra_index);
    qnabot.log(event)
    var request_params = {
        kendra_faq_index:kendra_index,
        question:event.question,
        size:10, // limit kendra hits to 10 max to avoid pagination issues
        es_address: event.endpoint,
        es_path: event.path,
        minimum_score: event.minimum_score,
    } ;
    var kendra_response = await kendra.handler(request_params);
    return kendra_response;
}

module.exports= async (event, context, callback) => {
    var settings = await get_settings();
    qna_settings.set_environment_variables(settings)
    qnabot.log('Received event:', JSON.stringify(event, null, 2));

    var kendra_index = _.get(settings, "KENDRA_FAQ_INDEX")
    event.minimum_score = _.get(settings, 'ALT_SEARCH_KENDRA_FAQ_CONFIDENCE_SCORE', "MEDIUM")
    var question = _.get(event,'question','');
    var topic = _.get(event,'topic','');
    
    let req = {
        question: question,    
    }
    //TODO: At some point we should expose a qnaClientFilter field in the
    //Content Designer and pass the value here.
    let params = {
        topic: topic,
        kendraIndex: kendra_index,
        question: question
    }
    let okKendraQuery = !(await open_es.isESonly(req,params))
    if ( okKendraQuery ) {
        var response = await run_query_kendra(event, kendra_index);
        // ES fallback if KendraFAQ fails
        var hit = _.get(response, "hits.hits[0]._source");
        if (!hit && _.get(settings, 'KENDRA_FAQ_ES_FALLBACK', false)){
            qnabot.log("ES Fallback");
            response = await run_query_es(event, settings);
        }
    } else {
        var response = await run_query_es(event, settings);
    }
    qnabot.log("Query response: ", JSON.stringify(response,null,2));
    return callback(null, response);
}
