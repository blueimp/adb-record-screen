# adb record screen
> Screen recording function using
> [Android Debug Bridge](https://developer.android.com/studio/command-line/adb)
> (`adb`).

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [License](#license)
- [Author](#author)

## Requirements
This is a thin wrapper around
[adb](https://developer.android.com/studio/command-line/adb) and has no other
dependencies.

## Installation
```sh
npm install adb-record-screen
```

## Usage

```js
const recordScreen = require('adb-record-screen')

const recording = recordScreen('/tmp/test.mp4', {
  bugreport: true
})

recording.promise
  .then(result => {
    // Screen recording is done
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
  })
  .catch(error => {
    // Screen recording has failed
    console.error(error)
  })

// As an example, stop the screen recording after 5 seconds:
setTimeout(() => recording.stop(), 5000)
```

## Options

```js
const defaultOptions = {
  serial: undefined,      // Use device with given serial
  transportID: undefined, // Use device with given transport ID
  hostname: undefined,    // Android device hostname
  port: 5555,             // Android device port
  waitTimeout: 5000,      // Device wait timeout (ms), set to 0 to disable wait
  bugreport: undefined,   // Set to `true` to add additional info to the video
  size: undefined,        // WIDTHxHEIGHT, defaults to native device resolution
  bitRate: undefined,     // Bits per second, default value is 4000000 (4Mbps)
  timeLimit: undefined,   // Seconds, default and maximum value is 180 (3 mins)
  pullDelay: 200          // Milliseconds, delay before pulling the video file
}
```

## License
Released under the [MIT license](https://opensource.org/licenses/MIT).

## Author
[Sebastian Tschan](https://blueimp.net/)
