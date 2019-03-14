'use strict'

/* global describe, after, it */

const assert = require('assert')
const fs = require('fs')
const execFile = require('util').promisify(require('child_process').execFile)
const recordScreen = require('.')

const mochaTimeout = 15000
const mochaSlow = 10000

const videoFile = '/tmp/test.mp4'
const recordingLength = 2000

function checkVideoIntegrity (videoFile) {
  return execFile('ffmpeg', ['-v', 'error', '-i', videoFile, '-f', 'null', '-'])
}

async function getVideoLength (videoFile) {
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
    const recording = recordScreen(videoFile)
    const cmd = await recording.promise.catch(error => error.cmd)
    assert.strictEqual(
      cmd.replace(/\w+\.mp4$/, 'video.mp4'),
      'adb shell screenrecord --verbose /sdcard/Movies/video.mp4'
    )
  })

  it('handles option: serial', async function () {
    const recording = recordScreen(videoFile, {
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
    setTimeout(() => recording.stop(), recordingLength + 500)
    // Start some activities, as without screen changes the video will be empty:
    setTimeout(openChrome, 0)
    setTimeout(showHomeScreen, recordingLength / 2)
    await recording.promise
    await checkVideoIntegrity(videoFile)
    const videoLength = await getVideoLength(videoFile)
    const expectedLength = recordingLength / 1000
    if (!(videoLength >= expectedLength)) {
      throw new assert.AssertionError({
        message: 'Recording does not have the expected length.',
        actual: videoLength,
        expected: expectedLength,
        operator: '>='
      })
    }
  })
})
