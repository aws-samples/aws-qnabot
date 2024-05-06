#!/bin/bash
######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                      			 #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

python3 ${NIGHTSWATCH_TEST_DIR}/scripts/delete_s3_bucket.py
sleep 20

python3 ${NIGHTSWATCH_TEST_DIR}/scripts/delete_role.py
sleep 10

echo 'DELETING KENDRA DATA SOURCE:-------------------------------------------------------------'
python3 ${NIGHTSWATCH_TEST_DIR}/scripts/delete_kendra_data_source.py
sleep 10

