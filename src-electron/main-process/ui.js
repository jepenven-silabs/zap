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
 */
const { dialog } = require('electron')

const importJs = require('../importexport/import.js')
const windowJs = require('./window.js')
const env = require('../util/env.js')
/*
 * Created Date: Tuesday, March 10th 2020, 4:22:57 pm
 * Author: Timotej Ecimovic
 *
 * Copyright (c) 2020 Silicon Labs
 */

// You can always use this to show an exception.
function showErrorMessage(title, err) {
  var msg
  if (err instanceof Error) {
    msg = err.toString() + '\n\nStack trace:\n' + err.stack
  } else {
    msg = err
  }
  dialog.showErrorBox(title, msg)
}

/**
 * Process a single file, parsing it in as JSON and then possibly opening
 * a new window if all is good.
 *
 * @param {*} db
 * @param {*} filePath
 * @param {*} httpPort Server port for the URL that will be constructed.
 */
function readAndOpenFile(db, filePath, httpPort) {
  env.logInfo(`Read and open: ${filePath}`)
  return importJs
    .importDataFromFile(env.mainDatabase(), filePath)
    .then((sessionId) => {
      windowJs.windowCreate(httpPort, {
        filePath: filePath,
        sessionId: sessionId,
      })
      return true
    })
    .catch((err) => {
      showErrorMessage(filePath, err)
    })
}

/**
 * Creates a new window with a blank configuration.
 *
 * @param {*} httpPort
 * @param {*} uiMode
 * @param {*} embeddedMode
 */
function openNewConfiguration(httpPort, uiMode, embeddedMode) {
  windowJs.windowCreate(httpPort, {
    uiMode: uiMode,
    embeddedMode: embeddedMode,
  })
}

exports.showErrorMessage = showErrorMessage
exports.readAndOpenFile = readAndOpenFile
exports.openNewConfiguration = openNewConfiguration
