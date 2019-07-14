/*
 * Screen recording function using Android Debug Bridge (adb).
 *
 * Copyright 2019, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 */

// @ts-check
'use strict'

const { execFile, execFileSync } = require('child_process')
const crypto = require('crypto')
const util = require('util')
const execFilePromise = util.promisify(execFile)

/**
 * Builds arguments for an ADB call.
 *
 * @param {object} options ADB options
 * @param {string} [options.serial] Use device with given serial
 * @param {string} [options.transportID] Use device with given transport ID
 * @returns {Array<string>} List of ADB arguments
 */
function buildADBArgs(options) {
  const args = []
  if (options.serial) {
    // Select the device with the given serial:
    args.push('-s', options.serial)
  }
  if (options.transportID) {
    // Select the device with the given transport ID:
    args.push('-t', options.transportID)
  }
  return args
}

/**
 * Builds arguments for the screenrecord call.
 *
 * @param {string} fileName Local file name
 * @param {object} options Screen recording options
 * @param {boolean} [options.bugreport] If `true` adds additional info to video
 * @param {string} [options.size] WIDTHxHEIGHT, defaults to device resolution
 * @param {number} [options.bitRate=4000000] Bits per second, default is 4Mbps
 * @param {number} [options.timeLimit=180] Time limit (s), maximum is 180
 * @returns {Array<string>} List of screenrecord arguments
 */
function buildScreenRecordArgs(fileName, options) {
  const args = ['shell', 'screenrecord', '--verbose']
  if (options.bugreport) {
    // Adds additional information to the video, such as a timestamp overlay:
    args.push('--bugreport')
  }
  if (options.size) {
    // WIDTHxHEIGHT, defaults to native device resolution:
    args.push('--size', options.size)
  }
  if (options.bitRate) {
    // Bits per second, default value is 4000000 (4Mbps)
    args.push('--bit-rate', String(options.bitRate))
  }
  if (options.timeLimit) {
    // Seconds, default and maximum value is 180 (3 mins)
    args.push('--time-limit', String(options.timeLimit))
  }
  args.push(fileName)
  return args
}

/**
 * @typedef {object} Result
 * @property {string} stdout Screen recording standard output
 * @property {string} stderr Screen recording error output
 */

/**
 * @typedef {object} Recording
 * @property {Promise<Result>} promise Promise for the active screen recording
 * @property {Function} stop Function to stop the screen recording
 */

/**
 * @typedef {object} Options Screen recording options
 * @property {string} [serial] Use device with given serial
 * @property {string} [transportID] Use device with given transport ID
 * @property {string} [hostname] Android device hostname
 * @property {number} [port=5555] Android device port
 * @property {number} [waitTimeout=5000] Device wait timeout (ms)
 * @property {boolean} [bugreport] If `true` adds additional info to the video
 * @property {string} [size] WIDTHxHEIGHT, defaults to native device resolution
 * @property {number} [bitRate=4000000] Bits per second, default is 4Mbps
 * @property {number} [timeLimit=180] Time limit (s), maximum is 180 (3 mins)
 * @property {number} [pullDelay=200] Delay (ms) before pulling the video file
 */

/**
 * Starts a screen recording via adb shell screenrecord.
 *
 * @param {string} fileName Output file name
 * @param {Options} [options] Screen recording options
 * @returns {Recording} Recording object
 */
function recordScreen(fileName, options) {
  const opts = Object.assign(
    {
      port: 5555,
      waitTimeout: 5000,
      pullDelay: 200
    },
    options
  )
  const fileID = crypto.randomBytes(16).toString('hex')
  const deviceFileName = `/sdcard/Movies/${fileID}.mp4`
  const adbArgs = buildADBArgs(opts)
  const args = adbArgs.concat(buildScreenRecordArgs(deviceFileName, opts))
  let connectOutput
  let waitForDeviceOutput
  let recordingProcess
  /**
   * Executes the recording process.
   *
   * @param {Function} resolve Success callback
   * @param {Function} reject Failure callback
   */
  function recordingExecutor(resolve, reject) {
    // Start the recording via `adb shell screenrecord [options] localFile`:
    recordingProcess = execFile('adb', args, function(error, stdout, stderr) {
      recordingProcess = null
      // @ts-ignore Error interface does not expose killed property
      if (error && !error.killed) return reject(error)
      const result = {
        // Combine the output data:
        stdout: [connectOutput, waitForDeviceOutput, stdout].join(''),
        stderr
      }
      // Add a delay before resolving, as pulling the video file directly after
      // terminating the recording process leads to corrupted files:
      setTimeout(function() {
        resolve(result)
      }, opts.pullDelay)
    })
  }
  /**
   * Stops the recording process.
   */
  function stop() {
    if (recordingProcess) recordingProcess.kill('SIGINT')
  }
  /**
   * Pulls the recording file from the Android device.
   *
   * @param {Result} result Result object
   * @returns {Promise<Result>} Promise resolving with a Result object
   */
  function pullFile(result) {
    // Retrieve the file via `adb pull -a remoteFile localFile`:
    const args = adbArgs.concat(['pull', '-a', deviceFileName, fileName])
    return execFilePromise('adb', args).then(function(nextResult) {
      // Combine the output data:
      return {
        // Remove the lines displaying download percentage from stdout:
        stdout: result.stdout + nextResult.stdout.replace(/[^\n]+%.+?\n/g, ''),
        stderr: result.stderr + nextResult.stderr
      }
    })
  }
  /**
   * Deletes the recording file from the Android device.
   *
   * @param {Result} result Result object
   * @returns {Promise<Result>} Promise resolving with a Result object
   */
  function deleteFile(result) {
    // Delete the file from the Android device and broadcast the file change:
    const file = deviceFileName
    const action = 'android.intent.action.MEDIA_SCANNER_SCAN_FILE'
    const cmd = `rm ${file} && am broadcast -a ${action} -d file://${file}`
    const args = adbArgs.concat(['shell', cmd])
    return execFilePromise('adb', args).then(function(nextResult) {
      // Combine the output data:
      return {
        stdout: result.stdout + nextResult.stdout,
        stderr: result.stderr + nextResult.stderr
      }
    })
  }
  if (opts.hostname) {
    // Connect to a device via TCP/IP:
    try {
      connectOutput = execFileSync(
        'adb',
        ['connect', `${opts.hostname}:${opts.port}`],
        { stdio: 'pipe' } // Make stderr available on the error object
      ).toString()
    } catch (error) {
      return { promise: Promise.reject(error), stop }
    }
  }
  if (opts.waitTimeout) {
    try {
      waitForDeviceOutput = execFileSync('adb', ['wait-for-device'], {
        timeout: opts.waitTimeout,
        stdio: 'pipe' // Make stderr available on the error object
      }).toString()
    } catch (error) {
      return { promise: Promise.reject(error), stop }
    }
  }
  const promise = new Promise(recordingExecutor).then(pullFile).then(deleteFile)
  return { promise, stop }
}

module.exports = recordScreen
