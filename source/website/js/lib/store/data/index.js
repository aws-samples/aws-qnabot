/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

const Vuex = require('vuex');

module.exports = {
    namespaced: true,
    state: {
        QAs: [],
        schema: {},
        filter: '',
        loading: false,
    },
    mutations: require('./mutations'),
    getters: require('./getters'),
    actions: require('./actions'),
};
