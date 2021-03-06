/**
 *
 *    Copyright (c) 2020 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 *
 *
 * @jest-environment node
 */

const path = require('path')
const genEngine = require('../src-electron/generator/generation-engine.js')
const args = require('../src-electron/util/args.js')
const env = require('../src-electron/util/env.js')
const dbApi = require('../src-electron/db/db-api.js')
const zclLoader = require('../src-electron/zcl/zcl-loader.js')
const importJs = require('../src-electron/importexport/import.js')
const testUtil = require('./test-util.js')
const queryEndpoint = require('../src-electron/db/query-endpoint.js')
const types = require('../src-electron/util/types.js')
const bin = require('../src-electron/util/bin.js')

var db
const templateCount = 12
const genTimeout = 3000
const testFile = path.join(__dirname, 'resource/three-endpoint-device.zap')
var sessionId
var templateContext
var zclContext

beforeAll(() => {
  var file = env.sqliteTestFile('endpointconfig')
  return dbApi
    .initDatabaseAndLoadSchema(file, env.schemaFile(), env.zapVersion())
    .then((d) => {
      db = d
      env.logInfo('DB initialized.')
    })
}, 5000)

afterAll(() => {
  return dbApi.closeDatabase(db)
})

test(
  'Basic gen template parsing and generation',
  () =>
    genEngine
      .loadTemplates(db, testUtil.testZigbeeGenerationTemplates)
      .then((context) => {
        expect(context.crc).not.toBeNull()
        expect(context.templateData).not.toBeNull()
        expect(context.templateData.name).toEqual('Test templates')
        expect(context.templateData.version).toEqual('test-v1')
        expect(context.templateData.templates.length).toEqual(templateCount)
        expect(context.packageId).not.toBeNull()
        templateContext = context
      }),
  3000
)

test(
  'Load ZCL stuff',
  () =>
    zclLoader.loadZcl(db, args.zclPropertiesFile).then((context) => {
      zclContext = context
    }),
  5000
)

test('Test file import', () =>
  importJs.importDataFromFile(db, testFile).then((s) => {
    sessionId = s
    expect(s).not.toBeNull()
  }))

test('Test endpoint config queries', () =>
  queryEndpoint
    .queryEndpointTypes(db, sessionId)
    .then((epts) => {
      expect(epts.length).toBe(3)
      return epts
    })
    .then((epts) => {
      var ps = []
      epts.forEach((ept) => {
        ps.push(queryEndpoint.queryEndpointClusters(db, ept.id))
      })
      return Promise.all(ps)
    })
    .then((clusterArray) => {
      expect(clusterArray.length).toBe(3)
      expect(clusterArray[0].length).toBe(28)
      expect(clusterArray[1].length).toBe(5)
      expect(clusterArray[2].length).toBe(7)
      var promiseAttributes = []
      var promiseCommands = []
      clusterArray.forEach((clusters) => {
        clusters.forEach((cluster) => {
          promiseAttributes.push(
            queryEndpoint.queryEndpointClusterAttributes(
              db,
              cluster.clusterId,
              cluster.side,
              cluster.endpointTypeId
            )
          )
          promiseCommands.push(
            queryEndpoint.queryEndpointClusterCommands(
              db,
              cluster.clusterId,
              cluster.endpointTypeId
            )
          )
        })
      })
      return Promise.all([
        Promise.all(promiseAttributes),
        Promise.all(promiseCommands),
      ])
    })
    .then((twoLists) => {
      var attributeLists = twoLists[0]
      var commandLists = twoLists[1]
      expect(attributeLists.length).toBe(40)
      expect(commandLists.length).toBe(40)

      var atSums = {}
      attributeLists.forEach((al) => {
        var l = al.length
        if (atSums[l]) {
          atSums[l]++
        } else {
          atSums[l] = 1
        }
      })
      expect(atSums[0]).toBe(18)

      var cmdSums = {}
      commandLists.forEach((cl) => {
        var l = cl.length
        if (cmdSums[l]) {
          cmdSums[l]++
        } else {
          cmdSums[l] = 1
        }
      })
      expect(cmdSums[0]).toBe(15)
    }))

test('Some intermediate queries', () =>
  types.typeSize(db, zclContext.packageId, 'bitmap8').then((size) => {
    expect(size).toBe(1)
  }))

test(
  'Test endpoint config generation',
  () =>
    genEngine
      .generate(db, sessionId, templateContext.packageId)
      .then((genResult) => {
        expect(genResult).not.toBeNull()
        expect(genResult.partial).toBeFalsy()
        expect(genResult.content).not.toBeNull()

        var epc = genResult.content['zap-config.h']
        var epcLines = epc.split(/\r?\n/)
        expect(
          epc.includes(
            '#define FIXED_ENDPOINT_ARRAY { 0x0029, 0x002A, 0x002B }'
          )
        ).toBeTruthy()
        expect(
          epc.includes(
            "17, 'V', 'e', 'r', 'y', ' ', 'l', 'o', 'n', 'g', ' ', 'u', 's', 'e', 'r', ' ', 'i', 'd', 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,"
          )
        ).toBeTruthy()
        expect(
          epc.includes(
            '{ ZAP_REPORT_DIRECTION(REPORTED), 0x0029, 0x0101, 0x002A, ZAP_CLUSTER_MASK(SERVER), 0x0000, 0, 65344, 0 }, /* Reporting for cluster: "Door Lock", attribute: "enable inside status led". side: server */'
          )
        ).toBeTruthy()
        expect(
          epc.includes(bin.hexToCBytes(bin.stringToHex('Very long user id')))
        )
        expect(epc.includes('#define FIXED_NETWORKS { 1, 1, 2 }')).toBeTruthy()
        expect(
          epc.includes('#define FIXED_PROFILE_IDS { 0x0107, 0x0104, 0x0104 }')
        ).toBeTruthy()
        expect(
          epc.includes('#define FIXED_ENDPOINT_TYPES { 0, 1, 2 }')
        ).toBeTruthy()
        expect(epcLines.length).toBeGreaterThan(100)
        var cnt = 0
        epcLines.forEach((line) => {
          if (line.includes('ZAP_TYPE(')) {
            expect(line.includes('undefined')).toBeFalsy()
            cnt++
          }
        })
        expect(cnt).toBe(101)
      }),
  genTimeout
)
