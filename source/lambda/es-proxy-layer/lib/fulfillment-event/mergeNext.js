/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

const _ = require('lodash');
const qnabot = require('qnabot/logging');

function mergeMarkdown(hit1, hit2) {
    // get markdown from first item
    const md1 = _.get(hit1, 'alt.markdown');
    let md1_to_merge = hit1.a
    if (md1) {
        md1_to_merge = md1.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
    }
    qnabot.debug('markdown from first hit:', md1_to_merge)

    // get markdown from second item
    const md2 = _.get(hit2, 'alt.markdown');
    let md2_to_merge = hit2.a
    if (md2) {
        md2_to_merge = md2.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '')
    }
    qnabot.debug('markdown from second hit:', md2_to_merge)

    // merge markdown, if present in either item
    if (md1 || md2) {
        const md_merged = `${md1_to_merge}\n${md2_to_merge}`
        qnabot.debug('Merged markdown:', md_merged)
        _.set(hit2, 'alt.markdown', md_merged);
    } else {
        qnabot.debug('Markdown field missing from both items. Skipping markdown merge');
    }
}

function mergeSSML(hit1, hit2) {
    // get SSML from first item
    const ssml1 = _.get(hit1, 'alt.ssml');
    let ssml1_to_merge = hit1.a
    if (ssml1) {
        // strip <speak> tags
        qnabot.debug('SSML from first hit:', ssml1)
        ssml1_to_merge = ssml1.replace(/<speak>|<\/speak>/g, '').trim();
    }

    // get SSML from second item
    const ssml2 = _.get(hit2, 'alt.ssml');
    let ssml2_to_merge = hit2.a
    if (ssml2) {
        // strip <speak> tags
        qnabot.debug('SSML from second hit:', ssml2)
        ssml2_to_merge = ssml2.replace(/<speak>|<\/speak>/g, '').trim();
    }

    // merge SSML, if present in either item
    if (ssml1 || ssml2) {
        // concatenate, and re-wrap with <speak> tags
        const ssml_merged = `<speak>${ssml1_to_merge} ${ssml2_to_merge}</speak>`
        qnabot.debug('Merged SSML:', ssml_merged)
        _.set(hit2, 'alt.ssml', ssml_merged);
    } else {
        qnabot.debug('SSML field missing from both items. Skipping SSML merge');
    }
}

function mergeNext(hit1, hit2) {
    if (hit1 === undefined) {
        return hit2;
    }
    qnabot.debug('Merge chained items');

    // merge alternate answers
    mergeMarkdown(hit1, hit2)
    mergeSSML(hit1, hit2)

    // merge plaintext answer
    if (hit1 && hit1.a) {
        hit2.a = hit1.a.trim() + ' ' + hit2.a.trim();
    }

    // build arrays of Lambda Hooks and arguments
    let lambdahooks = _.get(hit1, 'lambdahooks', []);
    // if hits1 doesn't have a lambdahooks field (no previous merge), then initialize using 'l' and 'args' from hit 1
    if (lambdahooks.length == 0) {
        lambdahooks = [
            {
                l: _.get(hit1, 'l'),
                args: _.get(hit1, 'args', []),
            },
        ];
    }
    lambdahooks.push({
        l: _.get(hit2, 'l'),
        args: _.get(hit2, 'args', []),
    });
    _.set(hit2, 'lambdahooks', lambdahooks);

    // all other fields inherited from item 2
    qnabot.debug('Items merged:', hit2);
    return hit2;
}
exports.mergeNext = mergeNext;
