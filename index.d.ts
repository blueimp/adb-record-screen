export = recordScreen;
/**
 * Starts a screen recording via adb shell screenrecord.
 *
 * @param {string} fileName Output file name
 * @param {Options} [options] Screen recording options
 * @returns {Recording} Recording object
 */
declare function recordScreen(fileName: string, options?: Options): Recording;
declare namespace recordScreen {
    export { Result, Recording, Options };
}
/**
 * Screen recording options
 */
type Options = {
    /**
     * Use device with given serial
     */
    serial?: string;
    /**
     * Use device with given transport ID
     */
    transportID?: string;
    /**
     * Android device hostname
     */
    hostname?: string;
    /**
     * Android device port
     */
    port?: number;
    /**
     * Device wait timeout (ms)
     */
    waitTimeout?: number;
    /**
     * If `true` adds additional info to the video
     */
    bugreport?: boolean;
    /**
     * WIDTHxHEIGHT, defaults to native device resolution
     */
    size?: string;
    /**
     * Bits per second, default is 4Mbps
     */
    bitRate?: number;
    /**
     * Time limit (s), maximum is 180 (3 mins)
     */
    timeLimit?: number;
    /**
     * Delay (ms) before pulling the video file
     */
    pullDelay?: number;
};
type Recording = {
    /**
     * Promise for the active screen recording
     */
    promise: Promise<Result>;
    /**
     * Function to stop the screen recording
     */
    stop: Function;
};
type Result = {
    /**
     * Screen recording standard output
     */
    stdout: string;
    /**
     * Screen recording error output
     */
    stderr: string;
};
