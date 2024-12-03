/** ************************************************************************************************
*   Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                             *
*   SPDX-License-Identifier: Apache-2.0                                                            *
 ************************************************************************************************ */

/**
 *
 * SlotTypes, Intents, and Bots for elicit response bots.
 *
 */
const botDateVersion = `${process.env.npm_package_version} - v2`; // CHANGE ME TO FORCE BOT REBUILD

const _ = require('lodash');
const util = require('../../util');

exports.resources = {
    BotRuntimeRole: {
        Type: 'AWS::IAM::Role',
        Condition: 'CreateLexResponseBots',
        Properties: {
            AssumeRolePolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lexv2.amazonaws.com',
                        },
                        Action: [
                            'sts:AssumeRole',
                        ],
                    },
                ],
            },
            Path: '/',
            Policies: [
                {
                    PolicyName: 'Polly',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Effect: 'Allow',
                                Action: [
                                    'polly:SynthesizeSpeech',
                                ],
                                Resource: { 'Fn::Sub': 'arn:${AWS::Partition}:polly:${AWS::Region}:${AWS::AccountId}:lexicon/*' },
                            },
                        ],
                    },
                },
                {
                    PolicyName: 'Comprehend',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Effect: 'Allow',
                                Action: [
                                    'comprehend:DetectSentiment',
                                ],
                                Resource: '*', // these actions cannot be bound to resources other than *
                            },
                        ],
                    },
                },
            ],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W11'], 'comprehend:DetectSentiment action cannot be bound to a resource'),
            guard: util.cfnGuard('IAM_NO_INLINE_POLICY_CHECK'),
        },
    },

    ResponseBotQNAWageV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: 'BotRuntimeRole',
        Properties: {
            AutoBuildBotLocales: true,
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAWageSlotType',
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'ORIGINAL_VALUE',
                            RegexFilter: {
                                Pattern: '[0-9]{1,7}',
                            },
                        },
                        ParentSlotTypeSignature: 'AMAZON.AlphaNumeric',
                    },
                ],
                Intents: [{
                    Name: 'WageIntent',
                    SampleUtterances: [
                        { Utterance: 'My salary is {Wage}' },
                        { Utterance: 'My wage is {Wage}' },
                        { Utterance: '{Wage}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {Wage} correct (Yes/No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please tell me your wage again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Wage',
                    }],
                    Slots: [{
                        Name: 'Wage',
                        SlotTypeName: 'QNAWageSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What is your wage?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Wage Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: 300,
            Name: { 'Fn::Sub': 'ResponseBot-QNAWageV2-${AWS::StackName}' },
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
        },
    },

    ResponseBotQNAWageVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAWageV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAWageV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAWageAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAWageVersionV2', 'ResponseBotQNAWageV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAWageV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAWageVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNASocialSecurityV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNASocialSecurityV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA SocialSecurity Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNASocialSecuritySlotType',
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'ORIGINAL_VALUE',
                            RegexFilter: {
                                Pattern: '[0-9]{3}-[0-9]{2}-[0-9]{4}',
                            },
                        },
                        ParentSlotTypeSignature: 'AMAZON.AlphaNumeric',
                    },
                ],
                Intents: [{
                    Name: 'SocialSecurityIntent',
                    SampleUtterances: [
                        { Utterance: 'The social security number is {SSN}' },
                        { Utterance: 'My social security number is {SSN}' },
                        { Utterance: 'It is {SSN}' },
                        { Utterance: '{SSN}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {SSN} correct (Yes/No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the social security number again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'SSN',
                    }],
                    Slots: [{
                        Name: 'SSN',
                        SlotTypeName: 'QNASocialSecuritySlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What is your social security number?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNASocialSecurityVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        Condition: 'CreateLexResponseBots',
        DependsOn: 'ResponseBotQNASocialSecurityV2',
        Properties: {
            BotId: { Ref: 'ResponseBotQNASocialSecurityV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNASocialSecurityAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNASocialSecurityVersionV2', 'ResponseBotQNASocialSecurityV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNASocialSecurityV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNASocialSecurityVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAPinV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAPinV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA PIN Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAPinSlotType',
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'ORIGINAL_VALUE',
                            RegexFilter: {
                                Pattern: '[0-9]{4}',
                            },
                        },
                        ParentSlotTypeSignature: 'AMAZON.AlphaNumeric',
                    },
                ],
                Intents: [{
                    Name: 'PINIntent',
                    SampleUtterances: [
                        { Utterance: 'The pin number is {Pin}' },
                        { Utterance: 'My pin number is {Pin}' },
                        { Utterance: 'It is {Pin}' },
                        { Utterance: '{Pin}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: '<speak>Is <say-as interpret-as="digits">{Pin}</say-as> correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'I\'m sorry I did not get all the digits, please re-enter all digits.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Pin',
                    }],
                    Slots: [{
                        Name: 'Pin',
                        SlotTypeName: 'QNAPinSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What are all the digits?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAPinVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        Condition: 'CreateLexResponseBots',
        DependsOn: 'ResponseBotQNAPinV2',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPinV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAPinAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAPinVersionV2', 'ResponseBotQNAPinV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPinV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAPinVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAPinNoConfirmV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAPinV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAPinNoConfirmV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA PIN Bot (NoConfirm) - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAPinNoConfirmSlotType',
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'ORIGINAL_VALUE',
                            RegexFilter: {
                                Pattern: '[0-9]{4}',
                            },
                        },
                        ParentSlotTypeSignature: 'AMAZON.AlphaNumeric',
                    },
                ],
                Intents: [{
                    Name: 'PINNoConfirmIntent',
                    SampleUtterances: [
                        { Utterance: 'The pin number is {Pin}' },
                        { Utterance: 'My pin number is {Pin}' },
                        { Utterance: 'It is {Pin}' },
                        { Utterance: '{Pin}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Pin',
                    }],
                    Slots: [{
                        Name: 'Pin',
                        SlotTypeName: 'QNAPinNoConfirmSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What are all the digits?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAPinNoConfirmVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAPinVersionV2', 'ResponseBotQNAPinNoConfirmV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPinNoConfirmV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAPinNoConfirmAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAPinNoConfirmVersionV2', 'ResponseBotQNAPinNoConfirmV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPinNoConfirmV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAPinNoConfirmVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAYesNoV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAPinV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAYesNoV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Yes No Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAYesNoSlotType',
                        SlotTypeValues: [
                            {
                                SampleValue: { Value: 'Yes' },
                                Synonyms: [
                                    { Value: 'Yes' },
                                    { Value: 'OK' },
                                    { Value: 'yeah' },
                                    { Value: 'sure' },
                                    { Value: 'yep' },
                                    { Value: 'affirmative' },
                                    { Value: 'aye' },
                                    { Value: 'correct' },
                                    { Value: 'one' },
                                    { Value: '1' },
                                ],
                            },
                            {
                                SampleValue: { Value: 'No' },
                                Synonyms: [
                                    { Value: 'no' },
                                    { Value: 'nope' },
                                    { Value: 'na' },
                                    { Value: 'negative' },
                                    { Value: 'non' },
                                    { Value: 'incorrect' },
                                    { Value: 'Two' },
                                    { Value: '2' },
                                ],
                            },
                        ],
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'TOP_RESOLUTION',
                        },
                    },
                ],
                Intents: [{
                    Name: 'YesNoIntent',
                    SampleUtterances: [
                        { Utterance: '{Yes_No}' },
                        { Utterance: 'I said {Yes_No}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Yes_No',
                    }],
                    Slots: [{
                        Name: 'Yes_No',
                        SlotTypeName: 'QNAYesNoSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'Say Yes or No.' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAYesNoVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAPinVersionV2', 'ResponseBotQNAYesNoV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAYesNoV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAYesNoAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAYesNoVersionV2', 'ResponseBotQNAYesNoV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAYesNoV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAYesNoVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAYesNoExitV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAPinV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAYesNoExitV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Yes No Exit Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAYesNoExitSlotType',
                        SlotTypeValues: [
                            {
                                SampleValue: { Value: 'Yes' },
                                Synonyms: [
                                    { Value: 'Yes' },
                                    { Value: 'OK' },
                                    { Value: 'yeah' },
                                    { Value: 'sure' },
                                    { Value: 'yep' },
                                    { Value: 'affirmative' },
                                    { Value: 'aye' },
                                    { Value: 'correct' },
                                    { Value: 'one' },
                                    { Value: '1' },
                                ],
                            },
                            {
                                SampleValue: { Value: 'No' },
                                Synonyms: [
                                    { Value: 'no' },
                                    { Value: 'nope' },
                                    { Value: 'na' },
                                    { Value: 'negative' },
                                    { Value: 'non' },
                                    { Value: 'incorrect' },
                                    { Value: 'Two' },
                                    { Value: '2' },
                                ],
                            },
                            {
                                SampleValue: { Value: 'Exit' },
                                Synonyms: [
                                    { Value: 'agent' },
                                    { Value: 'rep' },
                                    { Value: 'representative' },
                                    { Value: 'stop' },
                                    { Value: 'quit' },
                                    { Value: 'help' },
                                    { Value: 'bye' },
                                    { Value: 'goodbye' },
                                    { Value: 'three' },
                                    { Value: '3' },
                                ],
                            },
                        ],
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'TOP_RESOLUTION',
                        },
                    },
                ],
                Intents: [{
                    Name: 'YesNoExitIntent',
                    SampleUtterances: [
                        { Utterance: '{Yes_No_Exit}' },
                        { Utterance: 'I said {Yes_No_Exit}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Yes_No_Exit',
                    }],
                    Slots: [{
                        Name: 'Yes_No_Exit',
                        SlotTypeName: 'QNAYesNoExitSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'Say Yes, No, or Exit.' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAYesNoExitVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAPinVersionV2', 'ResponseBotQNAYesNoExitV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAYesNoExitV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAYesNoExitAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAYesNoExitVersionV2', 'ResponseBotQNAYesNoExitV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAYesNoExitV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAYesNoExitVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },
    ResponseBotQNADateV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAYesNoExitV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNADateV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Date Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'DateIntent',
                    SampleUtterances: [
                        { Utterance: 'The date is {date}' },
                        { Utterance: 'The date was {date}' },
                        { Utterance: 'I went on {date}' },
                        { Utterance: 'It is {date}' },
                        { Utterance: 'It occurred on {date}' },
                        { Utterance: 'I was born on {date}' },
                        { Utterance: 'My birthdate is {date}' },
                        { Utterance: 'My date of birth is {date}' },
                        { Utterance: '{date}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {date} correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the date again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'date',
                    }],
                    Slots: [{
                        Name: 'date',
                        SlotTypeName: 'AMAZON.Date',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What date?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNADateVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAYesNoExitVersionV2', 'ResponseBotQNADateV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNADateV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNADateAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNADateVersionV2', 'ResponseBotQNADateV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNADateV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNADateVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNADateNoConfirmV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAYesNoExitV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNADateNoConfirmV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Date Bot (NoConfirm) - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'DateNoConfirmIntent',
                    SampleUtterances: [
                        { Utterance: 'The date is {date}' },
                        { Utterance: 'The date was {date}' },
                        { Utterance: 'I went on {date}' },
                        { Utterance: 'It is {date}' },
                        { Utterance: 'It occurred on {date}' },
                        { Utterance: 'I was born on {date}' },
                        { Utterance: 'My birthdate is {date}' },
                        { Utterance: 'My date of birth is {date}' },
                        { Utterance: '{date}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'date',
                    }],
                    Slots: [{
                        Name: 'date',
                        SlotTypeName: 'AMAZON.Date',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What date?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNADateNoConfirmVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAYesNoExitVersionV2', 'ResponseBotQNADateNoConfirmV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNADateNoConfirmV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNADateNoConfirmAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNADateNoConfirmVersionV2', 'ResponseBotQNADateNoConfirmV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNADateNoConfirmV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNADateNoConfirmVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNADayOfWeekV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAYesNoExitV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNADayOfWeekV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA DayOfWeek Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNADayOfWeekSlotType',
                        SlotTypeValues: [
                            {
                                SampleValue: { Value: 'Sunday' },
                                Synonyms: [
                                    { Value: 'Su' },
                                    { Value: 'Sun' },
                                ],
                            }, {
                                SampleValue: { Value: 'Monday' },
                                Synonyms: [
                                    { Value: 'M' },
                                    { Value: 'Mo' },
                                    { Value: 'Mon' },
                                ],
                            }, {
                                SampleValue: { Value: 'Tuesday' },
                                Synonyms: [
                                    { Value: 'Tu' },
                                    { Value: 'Tue' },
                                    { Value: 'Tues' },
                                ],
                            }, {
                                SampleValue: { Value: 'Wednesday' },
                                Synonyms: [
                                    { Value: 'W' },
                                    { Value: 'We' },
                                    { Value: 'Wed' },
                                ],
                            }, {
                                SampleValue: { Value: 'Thursday' },
                                Synonyms: [
                                    { Value: 'Th' },
                                    { Value: 'Thu' },
                                    { Value: 'Thurs' },
                                ],
                            }, {
                                SampleValue: { Value: 'Friday' },
                                Synonyms: [
                                    { Value: 'F' },
                                    { Value: 'Fr' },
                                    { Value: 'Fri' },
                                ],
                            }, {
                                SampleValue: { Value: 'Saturday' },
                                Synonyms: [
                                    { Value: 'Sa' },
                                    { Value: 'Sat' },
                                ],
                            },
                        ],
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'TOP_RESOLUTION',
                        },
                    },
                ],
                Intents: [{
                    Name: 'DayOfWeekIntent',
                    SampleUtterances: [
                        { Utterance: 'The day is {DayOfWeek}' },
                        { Utterance: 'The day was {DayOfWeek}' },
                        { Utterance: 'I went on {DayOfWeek}' },
                        { Utterance: 'It is {DayOfWeek}' },
                        { Utterance: 'It occurred on {DayOfWeek}' },
                        { Utterance: '{DayOfWeek}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {DayOfWeek} correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the day of the week again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'DayOfWeek',
                    }],
                    Slots: [{
                        Name: 'DayOfWeek',
                        SlotTypeName: 'QNADayOfWeekSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What day of the week?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNADayOfWeekVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAYesNoExitVersionV2', 'ResponseBotQNADayOfWeekV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNADayOfWeekV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNADayOfWeekAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNADayOfWeekVersionV2', 'ResponseBotQNADayOfWeekV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNADayOfWeekV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNADayOfWeekVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAMonthV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNADayOfWeekV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAMonthV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Month Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAMonthSlotType',
                        SlotTypeValues: [
                            {
                                SampleValue: { Value: 'January' },
                                Synonyms: [
                                    { Value: 'Jan' },
                                    { Value: '01' },
                                ],
                            }, {
                                SampleValue: { Value: 'February' },
                                Synonyms: [
                                    { Value: 'Feb' },
                                    { Value: '02' },
                                ],
                            }, {
                                SampleValue: { Value: 'March' },
                                Synonyms: [
                                    { Value: 'Mar' },
                                    { Value: '03' },
                                ],
                            }, {
                                SampleValue: { Value: 'April' },
                                Synonyms: [
                                    { Value: 'Apr' },
                                    { Value: '04' },
                                ],
                            }, {
                                SampleValue: { Value: 'May' },
                                Synonyms: [
                                    { Value: '05' },
                                ],
                            }, {
                                SampleValue: { Value: 'June' },
                                Synonyms: [
                                    { Value: 'Jun' },
                                    { Value: '06' },
                                ],
                            }, {
                                SampleValue: { Value: 'July' },
                                Synonyms: [
                                    { Value: 'Jul' },
                                    { Value: '07' },
                                ],
                            }, {
                                SampleValue: { Value: 'August' },
                                Synonyms: [
                                    { Value: 'Aug' },
                                    { Value: '08' },
                                ],
                            }, {
                                SampleValue: { Value: 'September' },
                                Synonyms: [
                                    { Value: 'Sep' },
                                    { Value: 'Sept' },
                                    { Value: '09' },
                                ],
                            }, {
                                SampleValue: { Value: 'October' },
                                Synonyms: [
                                    { Value: 'Oct' },
                                    { Value: '10' },
                                ],
                            }, {
                                SampleValue: { Value: 'November' },
                                Synonyms: [
                                    { Value: 'Nov' },
                                    { Value: '11' },
                                ],
                            }, {
                                SampleValue: { Value: 'December' },
                                Synonyms: [
                                    { Value: 'Dec' },
                                    { Value: '12' },
                                ],
                            },

                        ],
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'TOP_RESOLUTION',
                        },
                    },
                ],
                Intents: [{
                    Name: 'MonthIntent',
                    SampleUtterances: [
                        { Utterance: 'The month is {Month}' },
                        { Utterance: 'The day was {Month}' },
                        { Utterance: 'It is {Month}' },
                        { Utterance: 'It occurred on {Month}' },
                        { Utterance: '{Month}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {Month} correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the month again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Month',
                    }],
                    Slots: [{
                        Name: 'Month',
                        SlotTypeName: 'QNAMonthSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What month?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAMonthVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNADayOfWeekVersionV2', 'ResponseBotQNAMonthV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAMonthV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAMonthAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAMonthVersionV2', 'ResponseBotQNAMonthV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAMonthV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAMonthVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAMonthNoConfirmV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNADayOfWeekV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAMonthNoConfirmV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Month Bot (NoConfirm) - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                SlotTypes: [
                    {
                        Name: 'QNAMonthNoConfirmSlotType',
                        SlotTypeValues: [
                            {
                                SampleValue: { Value: 'January' },
                                Synonyms: [
                                    { Value: 'Jan' },
                                    { Value: '01' },
                                ],
                            }, {
                                SampleValue: { Value: 'February' },
                                Synonyms: [
                                    { Value: 'Feb' },
                                    { Value: '02' },
                                ],
                            }, {
                                SampleValue: { Value: 'March' },
                                Synonyms: [
                                    { Value: 'Mar' },
                                    { Value: '03' },
                                ],
                            }, {
                                SampleValue: { Value: 'April' },
                                Synonyms: [
                                    { Value: 'Apr' },
                                    { Value: '04' },
                                ],
                            }, {
                                SampleValue: { Value: 'May' },
                                Synonyms: [
                                    { Value: '05' },
                                ],
                            }, {
                                SampleValue: { Value: 'June' },
                                Synonyms: [
                                    { Value: 'Jun' },
                                    { Value: '06' },
                                ],
                            }, {
                                SampleValue: { Value: 'July' },
                                Synonyms: [
                                    { Value: 'Jul' },
                                    { Value: '07' },
                                ],
                            }, {
                                SampleValue: { Value: 'August' },
                                Synonyms: [
                                    { Value: 'Aug' },
                                    { Value: '08' },
                                ],
                            }, {
                                SampleValue: { Value: 'September' },
                                Synonyms: [
                                    { Value: 'Sep' },
                                    { Value: 'Sept' },
                                    { Value: '09' },
                                ],
                            }, {
                                SampleValue: { Value: 'October' },
                                Synonyms: [
                                    { Value: 'Oct' },
                                    { Value: '10' },
                                ],
                            }, {
                                SampleValue: { Value: 'November' },
                                Synonyms: [
                                    { Value: 'Nov' },
                                    { Value: '11' },
                                ],
                            }, {
                                SampleValue: { Value: 'December' },
                                Synonyms: [
                                    { Value: 'Dec' },
                                    { Value: '12' },
                                ],
                            },

                        ],
                        ValueSelectionSetting: {
                            ResolutionStrategy: 'TOP_RESOLUTION',
                        },
                    },
                ],
                Intents: [{
                    Name: 'MonthNoConfirmIntent',
                    SampleUtterances: [
                        { Utterance: 'The month is {Month}' },
                        { Utterance: 'The day was {Month}' },
                        { Utterance: 'It is {Month}' },
                        { Utterance: 'It occurred on {Month}' },
                        { Utterance: '{Month}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Month',
                    }],
                    Slots: [{
                        Name: 'Month',
                        SlotTypeName: 'QNAMonthNoConfirmSlotType',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What month?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAMonthNoConfirmVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNADayOfWeekVersionV2', 'ResponseBotQNAMonthNoConfirmV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAMonthNoConfirmV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAMonthNoConfirmAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAMonthNoConfirmVersionV2', 'ResponseBotQNAMonthNoConfirmV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAMonthNoConfirmV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAMonthNoConfirmVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNANumberV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNADayOfWeekV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNANumberV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Number Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'NumberIntent',
                    SampleUtterances: [
                        { Utterance: 'The number is {Number}' },
                        { Utterance: 'The number was {Number}' },
                        { Utterance: 'It is {Number}' },
                        { Utterance: '{Number}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: '<speak>Is <say-as interpret-as="digits">{Number}</say-as> correct (Yes or No)?</speak>' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the number again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Number',
                    }],
                    Slots: [{
                        Name: 'Number',
                        SlotTypeName: 'AMAZON.Number',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What  number?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNANumberVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNADayOfWeekVersionV2', 'ResponseBotQNANumberV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNANumberV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNANumberAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNANumberVersionV2', 'ResponseBotQNANumberV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNANumberV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNANumberVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNANumberNoConfirmV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNANumberV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNANumberNoConfirmV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Number Bot (NoConfirm) - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'NumberNoConfirmIntent',
                    SampleUtterances: [
                        { Utterance: 'The number is {Number}' },
                        { Utterance: 'The number was {Number}' },
                        { Utterance: 'It is {Number}' },
                        { Utterance: '{Number}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Number',
                    }],
                    Slots: [{
                        Name: 'Number',
                        SlotTypeName: 'AMAZON.Number',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What number?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNANumberNoConfirmVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNANumberVersionV2', 'ResponseBotQNANumberNoConfirmV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNANumberNoConfirmV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNANumberNoConfirmAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNANumberNoConfirmVersionV2', 'ResponseBotQNANumberNoConfirmV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNANumberNoConfirmV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNANumberNoConfirmVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAAgeV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNANumberV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAAgeV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Age Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'AgeIntent',
                    SampleUtterances: [
                        { Utterance: 'My age is {Age}' },
                        { Utterance: 'Age is {Age}' },
                        { Utterance: 'It is {Age}' },
                        { Utterance: 'I am {Age}' },
                        { Utterance: 'I am {Age} years old' },
                        { Utterance: 'His age is {Age}' },
                        { Utterance: 'He is {Age}' },
                        { Utterance: 'He is {Age} years old' },
                        { Utterance: 'Her age is {Age}' },
                        { Utterance: 'She is {Age}' },
                        { Utterance: 'She is {Age} years old' },
                        { Utterance: '{Age}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {Age} correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the age again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Age',
                    }],
                    Slots: [{
                        Name: 'Age',
                        SlotTypeName: 'AMAZON.Number',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What age?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAAgeVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNANumberVersionV2', 'ResponseBotQNAAgeV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAAgeV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAAgeAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAAgeVersionV2', 'ResponseBotQNAAgeV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAAgeV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAAgeVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAAgeNoConfirmV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNANumberV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAAgeNoConfirmV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Age No Confirm Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'AgeNoConfirmIntent',
                    SampleUtterances: [
                        { Utterance: 'My age is {Age}' },
                        { Utterance: 'Age is {Age}' },
                        { Utterance: 'It is {Age}' },
                        { Utterance: 'I am {Age}' },
                        { Utterance: 'I am {Age} years old' },
                        { Utterance: 'His age is {Age}' },
                        { Utterance: 'He is {Age}' },
                        { Utterance: 'He is {Age} years old' },
                        { Utterance: 'Her age is {Age}' },
                        { Utterance: 'She is {Age}' },
                        { Utterance: 'She is {Age} years old' },
                        { Utterance: '{Age}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Age',
                    }],
                    Slots: [{
                        Name: 'Age',
                        SlotTypeName: 'AMAZON.Number',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What age?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAAgeNoConfirmVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNANumberVersionV2', 'ResponseBotQNAAgeNoConfirmV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAAgeNoConfirmV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAAgeNoConfirmAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAAgeNoConfirmVersionV2', 'ResponseBotQNAAgeNoConfirmV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAAgeNoConfirmV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAAgeNoConfirmVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAPhoneNumberV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAAgeNoConfirmV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAPhoneNumberV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Phone Number Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'PhoneNumberIntent',
                    SampleUtterances: [
                        { Utterance: 'The phone number is {PhoneNumber}' },
                        { Utterance: 'My phone number is {PhoneNumber}' },
                        { Utterance: 'It is {PhoneNumber}' },
                        { Utterance: '{PhoneNumber}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: '<speak>Is <say-as interpret-as="telephone">{PhoneNumber}</say-as> correct (Yes or No)?</speak>' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the phone number again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'PhoneNumber',
                    }],
                    Slots: [{
                        Name: 'PhoneNumber',
                        SlotTypeName: 'AMAZON.PhoneNumber',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What phone number?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAPhoneNumberVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAAgeNoConfirmVersionV2', 'ResponseBotQNAPhoneNumberV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPhoneNumberV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAPhoneNumberAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAPhoneNumberVersionV2', 'ResponseBotQNAPhoneNumberV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPhoneNumberV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAPhoneNumberVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAPhoneNumberNoConfirmV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAAgeNoConfirmV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAPhoneNumberNoConfirmV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Phone Number Bot (NoConfirm) - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'NumberNoConfirmIntent',
                    SampleUtterances: [
                        { Utterance: 'The phone number is {PhoneNumber}' },
                        { Utterance: 'My phone number is {PhoneNumber}' },
                        { Utterance: 'It is {PhoneNumber}' },
                        { Utterance: '{PhoneNumber}' },
                    ],
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'PhoneNumber',
                    }],
                    Slots: [{
                        Name: 'PhoneNumber',
                        SlotTypeName: 'AMAZON.PhoneNumber',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What phone number?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAPhoneNumberNoConfirmVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAAgeNoConfirmVersionV2', 'ResponseBotQNAPhoneNumberNoConfirmV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPhoneNumberNoConfirmV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAPhoneNumberNoConfirmAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAPhoneNumberNoConfirmVersionV2', 'ResponseBotQNAPhoneNumberNoConfirmV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAPhoneNumberNoConfirmV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAPhoneNumberNoConfirmVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNATimeV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNAAgeNoConfirmV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNATimeV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Time Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'TimeIntent',
                    SampleUtterances: [
                        { Utterance: 'The time was {Time}' },
                        { Utterance: 'The time is {Time}' },
                        { Utterance: 'It occurred at {Time}' },
                        { Utterance: 'At {Time}' },
                        { Utterance: '{Time}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {Time} correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the time again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'Time',
                    }],
                    Slots: [{
                        Name: 'Time',
                        SlotTypeName: 'AMAZON.Time',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What time?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNATimeVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNAAgeNoConfirmVersionV2', 'ResponseBotQNATimeV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNATimeV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNATimeAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNATimeVersionV2', 'ResponseBotQNATimeV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNATimeV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNATimeVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNAEmailAddressV2: {
        Type: 'AWS::Lex::Bot',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNATimeV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNAEmailAddressV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Email Address Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'EmailAddressIntent',
                    SampleUtterances: [
                        { Utterance: 'My email address is {EmailAddress}' },
                        { Utterance: 'The email address is {EmailAddress}' },
                        { Utterance: '{EmailAddress}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Is {EmailAddress} correct (Yes or No)?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know the email address again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 1,
                        SlotName: 'EmailAddress',
                    }],
                    Slots: [{
                        Name: 'EmailAddress',
                        SlotTypeName: 'AMAZON.EmailAddress',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What email address?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNAEmailAddressVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNATimeVersionV2', 'ResponseBotQNAEmailAddressV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNAEmailAddressV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNAEmailAddressAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNAEmailAddressVersionV2', 'ResponseBotQNAEmailAddressV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNAEmailAddressV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNAEmailAddressVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

    ResponseBotQNANameV2: {
        Type: 'AWS::Lex::Bot',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['BotRuntimeRole', 'ResponseBotQNATimeV2'],
        Properties: {
            Name: { 'Fn::Sub': 'ResponseBot-QNANameV2-${AWS::StackName}' },
            DataPrivacy: { ChildDirected: false },
            Description: `QNA Name Bot - ${botDateVersion}`,
            IdleSessionTTLInSeconds: '300',
            RoleArn: { 'Fn::GetAtt': ['BotRuntimeRole', 'Arn'] },
            BotLocales: [{
                LocaleId: 'en_US',
                NluConfidenceThreshold: '0.40',
                VoiceSettings: { VoiceId: 'Salli' },
                Intents: [{
                    Name: 'NameIntent',
                    SampleUtterances: [
                        { Utterance: 'My last name is {LastName}' },
                        { Utterance: 'My first name is {FirstName}' },
                        { Utterance: 'My first name is {FirstName} and My last name is {LastName}' },
                        { Utterance: 'My name is {FirstName} {LastName}' },
                        { Utterance: 'I am {FirstName} {LastName}' },
                        { Utterance: '{FirstName} {LastName}' },
                        { Utterance: '{FirstName}' },
                        { Utterance: '{LastName}' },
                    ],
                    IntentConfirmationSetting: {
                        PromptSpecification: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Did I get your name right (Yes or No) {FirstName} {LastName}?' } },
                            }],
                            MaxRetries: 1,
                        },
                        DeclinationResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'Please let me know your name again.' } },
                            }],
                        },
                    },
                    IntentClosingSetting: {
                        ClosingResponse: {
                            MessageGroupsList: [{
                                Message: { PlainTextMessage: { Value: 'OK.' } },
                            }],
                        },
                    },
                    SlotPriorities: [{
                        Priority: 2,
                        SlotName: 'LastName',
                    }, {
                        Priority: 1,
                        SlotName: 'FirstName',
                    }],
                    Slots: [{
                        Name: 'FirstName',
                        SlotTypeName: 'AMAZON.FirstName',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What is your first name?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }, {
                        Name: 'LastName',
                        SlotTypeName: 'AMAZON.LastName',
                        ValueElicitationSetting: {
                            SlotConstraint: 'Required',
                            PromptSpecification: {
                                MessageGroupsList: [{
                                    Message: { PlainTextMessage: { Value: 'What is your last name?' } },
                                }],
                                MaxRetries: 2,
                                AllowInterrupt: true,
                            },
                        },
                    }],
                },
                {
                    Name: 'FallbackIntent',
                    Description: 'Default intent when no other intent matches',
                    ParentIntentSignature: 'AMAZON.FallbackIntent',
                }],
            }],
        },
    },

    ResponseBotQNANameVersionV2: {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Type: 'AWS::Lex::BotVersion',
        DependsOn: ['ResponseBotQNATimeVersionV2', 'ResponseBotQNANameV2'],
        Condition: 'CreateLexResponseBots',
        Properties: {
            BotId: { Ref: 'ResponseBotQNANameV2' },
            BotVersionLocaleSpecification: [{
                BotVersionLocaleDetails: {
                    SourceBotVersion: 'DRAFT',
                },
                LocaleId: 'en_US',
            }],
        },
    },

    ResponseBotQNANameAliasV2: {
        DeletionPolicy: 'Retain',
        Type: 'AWS::Lex::BotAlias',
        Condition: 'CreateLexResponseBots',
        DependsOn: ['ResponseBotQNANameVersionV2', 'ResponseBotQNANameV2'],
        Properties: {
            BotId: { Ref: 'ResponseBotQNANameV2' },
            BotAliasName: 'live',
            BotVersion: { 'Fn::GetAtt': ['ResponseBotQNANameVersionV2', 'BotVersion'] },
            BotAliasLocaleSettings: [{
                BotAliasLocaleSetting: {
                    Enabled: true,
                },
                LocaleId: 'en_US',
            }],
            SentimentAnalysisSettings: {
                DetectSentiment: false,
            },
        },
    },

};

exports.names = [
    'QNAWage', 'QNASocialSecurity', 'QNAPinNoConfirm', 'QNAPin', 'QNAYesNo', 'QNAYesNoExit', 'QNADate', 'QNADateNoConfirm', 'QNADayOfWeek', 'QNAMonth', 'QNAMonthNoConfirm',
    'QNANumber', 'QNANumberNoConfirm', 'QNAAge', 'QNAAgeNoConfirm', 'QNAPhoneNumber', 'QNAPhoneNumberNoConfirm', 'QNATime', 'QNAEmailAddress', 'QNAName',
];

exports.outputs = _.fromPairs(exports.names.map((x) => [x, { Value: { 'Fn::If': ['CreateLexResponseBots', { 'Fn::Join': ['', ['LexV2::', { Ref: `ResponseBot${x}V2` }, '/', { 'Fn::GetAtt': [`ResponseBot${x}AliasV2`, 'BotAliasId'] }, '/', 'en_US']] }, 'ReponseBots disabled'] } }]));
