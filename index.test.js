'use strict'

/* global describe, after, it */

/**
 * @typedef {object} MetaData Video stream meta data
 * @property {number} duration Video duration
 * @property {number} width Video width
 * @property {number} height Video height
 * @property {number} rotate Video rotation value
 */

const assert = require('assert')
const fs = require('fs')
const execFile = require('util').promisify(require('child_process').execFile)
const recordScreen = require('.')

const mochaTimeout = 15000
const mochaSlow = 10000

const videoFile = '/tmp/test.mp4'
const recordingDuration = 2000

/**
 * Checks the integrity of the given video file.
 *
 * @param {string} videoFile File path to the video file
 * @returns {Promise} Resolves for a valid file, rejects otherwise
 */
function checkVideoIntegrity(videoFile) {
  return execFile('ffmpeg', ['-v', 'error', '-i', videoFile, '-f', 'null', '-'])
}

/**
 * Checks the integrity of the given video file.
 *
 * @param {string} videoFile File path to the video file
 * @returns {Promise<MetaData>} Resolves with the video meta data
 */
async function getVideoMetaData(videoFile) {
  const result = await execFile('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=width,height:stream_tags=rotate',
    '-of',
    'json',
    videoFile
  ])
  const parsedResult = JSON.parse(result.stdout)
  const rotate = parsedResult.streams[0].tags.rotate
  return {
    duration: Number(parsedResult.format.duration),
    width: parsedResult.streams[0].width,
    height: parsedResult.streams[0].height,
    rotate: rotate === undefined ? rotate : Number(rotate)
  }
}

/**
 * Starts a given main activity on the Android device.
 *
 * @param {...string} args Command line arguments
 * @returns {Promise} Resolves if executed succesfully, rejects otherwise
 */
function startMainActivity(...args) {
  return execFile(
    'adb',
    ['shell', 'am', 'start', '-a', 'android.intent.action.MAIN'].concat(args)
  ).catch(error => console.error(error)) // eslint-disable-line no-console
}

/**
 * Opens Chrome on the Android device.
 *
 * @returns {Promise} Resolves if executed succesfully, rejects otherwise
 */
function openChrome() {
  return startMainActivity(
    '-n',
    'com.android.chrome/com.google.android.apps.chrome.Main'
  )
}

/**
 * Shows the home screen on the Android device.
 *
 * @returns {Promise} Resolves if executed succesfully, rejects otherwise
 */
function showHomeScreen() {
  return startMainActivity('-c', 'android.intent.category.HOME')
}

describe('screen recording', function () {
  this.timeout(mochaTimeout)
  this.slow(mochaSlow)

  after(function () {
    fs.unlinkSync(videoFile)
  })

  it('uses default options', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb shell screenrecord --verbose /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: serial', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0,
      serial: 'banana'
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb -s banana shell screenrecord --verbose /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: transportID', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0,
      transportID: 'banana'
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb -t banana shell screenrecord --verbose /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: bugreport', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0,
      bugreport: true
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb shell screenrecord --verbose --bugreport /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: size', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0,
      size: '1x1'
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb shell screenrecord --verbose --size 1x1 /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: bitRate', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0,
      bitRate: 400
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb shell screenrecord --verbose --bit-rate 400 /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: timeLimit', async function () {
    const recording = recordScreen(videoFile, {
      waitTimeout: 0,
      timeLimit: 9
    })
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb shell screenrecord --verbose --time-limit 9 /sdcard/Movies/video.mp4'
    )
  })

  it('records screen', async function () {
    // Touch the file name to check if it can override existing files:
    fs.closeSync(fs.openSync(videoFile, 'w'))
    const recording = recordScreen(videoFile, {
      hostname: process.env.ANDROID_HOST
    })
    // Start some activities, as without screen changes the video will be empty:
    setTimeout(openChrome, recordingDuration / 4)
    setTimeout(showHomeScreen, recordingDuration / 2)
    setTimeout(() => recording.stop(), recordingDuration + 500)
    const result = await recording.promise
    assert.strictEqual(result.stderr, '')
    const lines = result.stdout.split('\n')
    assert.ok(
      lines[0].indexOf(process.env.ANDROID_HOST) !== -1,
      'stdout starts with connect output'
    )
    const intent = 'android.intent.action.MEDIA_SCANNER_SCAN_FILE'
    assert.ok(
      result.stdout.indexOf(intent) !== -1,
      'stdout contains broadcasted intent'
    )
    await checkVideoIntegrity(videoFile)
    const metaData = await getVideoMetaData(videoFile)
    const expectedDuration = recordingDuration / 1000
    if (!(metaData.duration >= expectedDuration)) {
      throw new assert.AssertionError({
        message: 'Recording does not have the expected length.',
        actual: metaData.duration,
        expected: expectedDuration,
        operator: '>='
      })
    }
    if (!(metaData.width >= 320)) {
      throw new assert.AssertionError({
        message: 'Recording does not have the expected resolution width.',
        actual: metaData.width,
        expected: 320,
        operator: '>='
      })
    }
    if (!(metaData.width >= 480)) {
      throw new assert.AssertionError({
        message: 'Recording does not have the expected resolution height.',
        actual: metaData.width,
        expected: 480,
        operator: '>='
      })
    }
  })
})
