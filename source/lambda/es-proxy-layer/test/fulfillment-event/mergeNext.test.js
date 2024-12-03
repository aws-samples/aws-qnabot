/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

const _ = require('lodash');
const { mergeNext } = require('../../lib/fulfillment-event/mergeNext');

jest.mock('qnabot/settings');
jest.mock('qnabot/logging');

describe('mergeNext', () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('merges hits', async () => {
    const hit1 = {
      a: 'start',
      alt: {
        markdown: '#start',
        ssml: '<speak>start</speak>',
      },
    };
    const hit2 = {
      a: 'end',
      alt: {
        markdown: '#end',
        ssml: '<speak>end</speak>',
      },
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.markdown).toStrictEqual('#start\n#end')
    expect(result.alt.ssml).toStrictEqual('<speak>start end</speak>')
  });

  test('merges hits and trims whitespace', async () => {
    const hit1 = {
      a: '  start  ',
      alt: {
        markdown: '  #start  ',
        ssml: '  <speak>  start  </speak>  ',
      },
    };
    const hit2 = {
      a: '  end  ',
      alt: {
        markdown: '  #end  ',
        ssml: '  <speak>  end  </speak>  ',
      },
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.markdown).toStrictEqual('#start\n#end')
    expect(result.alt.ssml).toStrictEqual('<speak>start end</speak>')
  });


  test('merges ssml in the first hit', async () => {
    const hit1 = {
      a: 'start',
      alt: {
        ssml: '<speak>start</speak>',
      },
    };
    const hit2 = {
      a: 'end',
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.ssml).toStrictEqual('<speak>start end</speak>')
  });

  test('merges ssml in the second hit', async () => {
    const hit1 = {
      a: 'start',
    };
    const hit2 = {
      a: 'end',
      alt: {
        ssml: '<speak>end</speak>',
      },
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.ssml).toStrictEqual('<speak>start end</speak>')
  });

  test('merges markdown in the first hit', async () => {
    const hit1 = {
      a: 'start',
      alt: {
        markdown: '#start',
      },
    };
    const hit2 = {
      a: 'end',
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.markdown).toStrictEqual('#start\nend')
  });

  test('merges markdown in the second hit', async () => {
    const hit1 = {
      a: 'start',
    };
    const hit2 = {
      a: 'end',
      alt: {
        markdown: '#end',
      },
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.markdown).toStrictEqual('start\n#end')
  });

  test('merges markdown and preserves newlines', async () => {
    const hit1 = {
      a: 'start',
      alt: {
        markdown: '\n#start\n',
      },
    };
    const hit2 = {
      a: 'end',
      alt: {
        markdown: '\n#end\n',
      },
    }
    result = mergeNext(hit1, hit2)

    expect(result.a).toStrictEqual('start end')
    expect(result.alt.markdown).toStrictEqual('\n#start\n\n\n#end\n')
  });

});