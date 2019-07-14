// @ts-check
'use strict'

/* global describe, after, it */

const assert = require('assert')
const fs = require('fs')
const execFile = require('util').promisify(require('child_process').execFile)
const recordScreen = require('.')

const mochaTimeout = 15000
const mochaSlow = 10000

const videoFile = '/tmp/test.mp4'
const recordingDuration = 2000

function checkVideoIntegrity (videoFile) {
  return execFile('ffmpeg', ['-v', 'error', '-i', videoFile, '-f', 'null', '-'])
}

async function getVideoDuration (videoFile) {
  const result = await execFile('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    videoFile
  ])
  return Number(result.stdout.trim())
}

function startMainActivity (...args) {
  return execFile(
    'adb',
    ['shell', 'am', 'start', '-a', 'android.intent.action.MAIN'].concat(args)
  ).catch(error => console.error(error))
}

function openChrome () {
  return startMainActivity(
    '-n',
    'com.android.chrome/com.google.android.apps.chrome.Main'
  )
}

function showHomeScreen () {
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
    setTimeout(() => recording.stop(), recordingDuration + 500)
    // Start some activities, as without screen changes the video will be empty:
    setTimeout(openChrome, 0)
    setTimeout(showHomeScreen, recordingDuration / 2)
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
    const videoDuration = await getVideoDuration(videoFile)
    const expectedDuration = recordingDuration / 1000
    if (!(videoDuration >= expectedDuration)) {
      throw new assert.AssertionError({
        message: 'Recording does not have the expected length.',
        actual: videoDuration,
        expected: expectedDuration,
        operator: '>='
      })
    }
  })
})
