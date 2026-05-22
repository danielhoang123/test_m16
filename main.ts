basic.forever(function () {
	
})

//% color="#FEBC68" weight=2 icon="\uf001" block="M11"
//% groups="['Setting', 'Control', 'Get Info', 'Advanced Control']"
namespace mp3Player {
    export enum EQ {
        //% block="Normal"
        Normal = 0x00,  // DFPLAYER_EQ_NORMAL
        //% block="Pop"
        Pop = 0x01,     // DFPLAYER_EQ_POP
        //% block="Rock"
        Rock = 0x02,    // DFPLAYER_EQ_ROCK
        //% block="Jazz"
        Jazz = 0x03,    // DFPLAYER_EQ_JAZZ
        //% block="Classic"
        Classic = 0x04, // DFPLAYER_EQ_CLASSIC
        //% block="Bass"
        Bass = 0x05     // DFPLAYER_EQ_BASS
    }

    export enum PlayWhat {
        //% block="Next"
        Next = 0x01,
        //% block="Previous"
        Previous = 0x02
    }

    /* --------------------------------------------------------------------- */

    /**
     * Serial Mode: Instruction Description
     * 
     * Format: $S - VER - Len - CMD - Feedback - para1 - para2 - checksum - $O
     * |
     * [0] $S       : start bit                         0x7E
     * [1] VER      : version information               0xFF
     * [2] Len      : the number of bytes after "Len"   0x06
     * [3] CMD      : indicate the specific operations  -> 1 Byte
     * [4] Feedback : feedback (1) / no feedback (0)    -> 1 Byte
     * [5] para1    : query high data byte              -> 1 Byte
     * [6] para2    : query low data byte               -> 1 Byte
     * [7] checksum : accumulation and verification     -> 2 Byte
     * [8]          = 0 - ( [1] + [2] + [3] + [4] + [5] + [6] )
     * [9] $O       : end bit                           0xEF
     */
    const dataArr: number[] = [0x7E, 0xFF, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xEF];

    const DFPlayerCardInserted: number = 2;
    const DFPlayerCardRemoved: number = 3;
    const DFPlayerCardOnline: number = 4;
    const DFPlayerPlayFinished: number = 5;
    const DFPlayerError: number = 6;
    const DFPlayerUSBInserted: number = 7;
    const DFPlayerUSBRemoved: number = 8;
    const DFPlayerUSBOnline: number = 9;
    const DFPlayerCardUSBOnline: number = 10;
    const DFPlayerFeedBack: number = 11;

    const Stack_Version: number = 1;
    const Stack_Length: number = 2;
    const Stack_End: number = 9;

    const TimeOut: number = 0;
    const WrongStack: number = 1;

    let _isAvailable = false;
    let _handleType: number;
    let _handleParameter: number;
    let _receivedIndex = 0;
    let _isSending = false;
    let _handleCommand: number;
    let _timeOutTimer: number;

    const _received: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    /* --------------------------------------------------------------------- */

    /* Connect to MP3 Player */
    export function connect() {
        /**
         * Configure the serial port to use the pins instead of USB
         * 
         * function serial.redirect(tx: SerialPin, rx: SerialPin, rate: BaudRate): void;
         * tx   : the transmit pin to send serial data on
         * rx   : the receive pin to receive serial data on
         * rate : the baud rate for transmitting and receiving data
         * 
         * MP3Player <----> MicroBit
         * (RX)             P8 (TX)
         * (TX)             P2 (RX)
         */
        serial.redirect(SerialPin.P8, SerialPin.P2, BaudRate.BaudRate9600);
    }

    /* Calculate Checksum */
    export function checkSum() {
        /**
         * 2 Byte (16 bit)
         * 
         * 0 - 1 = -1 : 0xFFFF : 65,535 = 65,536 - 1
         * 0 - 2 = -2 : 0xFFFE : 65,534 = 65,536 - 2
         * ...
         */
        let total = 65536 - (dataArr[1] + dataArr[2] + dataArr[3] + dataArr[4] + dataArr[5] + dataArr[6]);

        dataArr[7] = total >> 8;    // para_H
        dataArr[8] = total & 0xFF;  // para_L
    }

    /* Send commands to MP3 Player */
    export function sendData() {
        let buf = pins.createBuffer(10);

        for (let index = 0; index < 10; index++) {
            buf.setNumber(NumberFormat.UInt8LE, index, dataArr[index])
        }
        serial.writeBuffer(buf);

        _timeOutTimer = input.runningTime();
        basic.pause(100);//!
    }

    /* Start the process of sending commands via Serial */
    export function innerCall(CMD: number, para1: number, para2: number) {
        /* Make sure MP3Player is connected */
        connect();

        dataArr[3] = CMD;
        dataArr[5] = para1;
        dataArr[6] = para2;

        checkSum();
        sendData();
    }

    /* --------------------------------------------------------------------- */

    export function handleMessage(type: number, parameter: number): boolean {
        _receivedIndex = 0;
        _handleType = type;
        _handleParameter = parameter;
        _isAvailable = true;

        return _isAvailable;
    }

    export function handleError(type: number, parameter: number): boolean {
        handleMessage(type, parameter);
        _isSending = false;

        return false;
    }

    export function validateStack(): boolean {
        let calCheckSum = 65536 - (_received[1] + _received[2] + _received[3] + _received[4] + _received[5] + _received[6]);
        let revCheckSum = _received[7] * 256 + _received[8];

        return calCheckSum == revCheckSum;
    }

    export function parseStack() {
        let handleCommand = _received[3];
        /**
         * Handle the 0x41 ack feedback as a spcecial case
         * In case the pollusion of _handleCommand, _handleParameter, and _handleType
         */
        if (handleCommand == 0x41) {
            _isSending = false;
            return;
        }

        _handleCommand = handleCommand;
        _handleParameter = _received[5] * 256 + _received[6];

        switch (_handleCommand) {
            case 0x3D:
                handleMessage(DFPlayerPlayFinished, _handleParameter);
                break;
            case 0x3F:
                if (_handleParameter & 0x01) {
                    handleMessage(DFPlayerUSBOnline, _handleParameter);
                }
                else if (_handleParameter & 0x02) {
                    handleMessage(DFPlayerCardOnline, _handleParameter);
                }
                else if (_handleParameter & 0x03) {
                    handleMessage(DFPlayerCardUSBOnline, _handleParameter);
                }
                break;
            case 0x3A:
                if (_handleParameter & 0x01) {
                    handleMessage(DFPlayerUSBInserted, _handleParameter);
                }
                else if (_handleParameter & 0x02) {
                    handleMessage(DFPlayerCardInserted, _handleParameter);
                }
                break;
            case 0x3B:
                if (_handleParameter & 0x01) {
                    handleMessage(DFPlayerUSBRemoved, _handleParameter);
                }
                else if (_handleParameter & 0x02) {
                    handleMessage(DFPlayerCardRemoved, _handleParameter);
                }
                break;
            case 0x40:
                handleMessage(DFPlayerError, _handleParameter);
                break;
            case 0x3C:
            case 0x3E:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
            case 0x47:
            case 0x48:
            case 0x49:
            case 0x4B:
            case 0x4C:
            case 0x4D:
            case 0x4E:
            case 0x4F:
                handleMessage(DFPlayerFeedBack, _handleParameter);
                break;
            default:
                handleError(WrongStack, 0);
                break;
        }
    }

    export function available(): boolean {
        let data = serial.readBuffer(0);
        while (_receivedIndex < data.length) {
            if (_receivedIndex == 0) {
                _received[0] = data.getNumber(NumberFormat.UInt8LE, 0);
                if (_received[0] == 0x7E) {
                    _receivedIndex++;
                }
            } else {
                _received[_receivedIndex] = data.getNumber(NumberFormat.UInt8LE, _receivedIndex);

                switch (_receivedIndex) {
                    case Stack_Version:
                        if (_received[_receivedIndex] != 0xFF) {
                            return handleError(WrongStack, 0);
                        }
                        break;
                    case Stack_Length:
                        if (_received[_receivedIndex] != 0x06) {
                            return handleError(WrongStack, 0);
                        }
                        break;
                    case Stack_End:
                        if (_received[_receivedIndex] != 0xEF) {
                            return handleError(WrongStack, 0);
                        } else {
                            if (validateStack()) {
                                _receivedIndex = 0;
                                parseStack();
                                return _isAvailable;
                            } else {
                                return handleError(WrongStack, 0);
                            }
                        }
                    default:
                        break;
                }

                _receivedIndex++;
            }
        }

        /* Over timeout 500ms */
        if (_isSending && (input.runningTime() - _timeOutTimer >= 500)) {
            return handleError(TimeOut, 0);
        }

        return _isAvailable;
    }

    export function waitAvailable(): boolean {
        let wait = input.runningTime();
        while (!available()) {
            /* Over timeout 500ms */
            if (input.runningTime() - wait > 500) {
                return false;
            }
        }
        return true;
    }

    export function readType(): number {
        _isAvailable = false;
        return _handleType;
    }

    export function read(): number {
        _isAvailable = false;
        return _handleParameter;
    }

    /* --------------------------------------------------------------------- */

    export function readEQ(): number {
        /* Query the current EQ */
        innerCall(0x44, 0x00, 0x00);

        if (waitAvailable()) {
            if (readType() == DFPlayerFeedBack)
                return read();
            else
                return -1;
        }
        else {
            return -1;
        }
    }

    export function readFileCounts(): number {
        /* Query the total number of U-disk files */
        innerCall(0x48, 0x00, 0x00);

        if (waitAvailable()) {
            if (readType() == DFPlayerFeedBack)
                return read();
            else
                return -1;
        }
        else {
            return -1;
        }
    }

    export function readVolume(): number {
        /* Query the current volume */
        innerCall(0x43, 0x00, 0x00);

        if (waitAvailable()) {
            return read();
        }
        else {
            return -1;
        }
    }

    export function getInfoMP3(): string {
        let info = "";
        let typeEQ = "";

        switch (readEQ()) {
            case 0: typeEQ = "Normal"; break;
            case 1: typeEQ = "Pop"; break;
            case 2: typeEQ = "Rock"; break;
            case 3: typeEQ = "Jazz"; break;
            case 4: typeEQ = "Classic"; break;
            case 5: typeEQ = "Bass"; break;
        }

        info = convertToText(readFileCounts()) + " files in SD Card.\n"
            + "Volume " + convertToText(readVolume()) + ".\n"
            + "EQ " + typeEQ + ".";

        /* Direct the serial input and output to use the USB connection */
        serial.redirectToUSB();
        return info;
    }

    /* --------------------------------------------------------------------- */

    /* Stop playing music after a period of time */
    export function playInPeriod(second: number) {
        let wait = input.runningTime() + 1000 * second;
        while (input.runningTime() <= wait) { }

        /* Pause */
        innerCall(0x0E, 0x00, 0x00);
    }

    /* --------------------------------------------------------------------- */

    export function waitFinishMusic() {
        let wrongStack = false;
        let timeOut = false;

        while (true) {
            basic.pause(500);//! Interval is set at 400ms
            if (available()) {
                if (readType() == DFPlayerPlayFinished) {
                    break;
                } else {
                    if (readType() == WrongStack) { wrongStack = true; }
                    else if (readType() == TimeOut) { timeOut = true; }
                    //
                    if (wrongStack && timeOut) { break; }
                }
            }
        }
    }

    /* --------------------------------------------------------------------- */

    /**
     * Perform volume up
     */
    //% block="M11 MP3 Player \\| Up volume from port (P2+P8)"
    //% inlineInputMode=inline
    //% weight=13
    //% group="Setting"
    export function upVolume() {
        // DFRobotDFPlayerMini::volumeUp()
        innerCall(0x04, 0x00, 0x00);

        serial.redirectToUSB();
    }

    /**
     * Perform volume down
     */
    //% block="M11 MP3 Player \\| Down volume from port (P2+P8)"
    //% inlineInputMode=inline
    //% weight=12
    //% group="Setting"
    export function downVolume() {
        // DFRobotDFPlayerMini::volumeDown()
        innerCall(0x05, 0x00, 0x00);

        serial.redirectToUSB();
    }

    /**
     * Perform volume adjustment
     * @param volume select sound level from 0 to 30
     */
    //% block="M11 MP3 Player \\| Set volume level $volume from port (P2+P8)"
    //% volume.defl=20 volume.min=0 volume.max=30
    //% inlineInputMode=inline
    //% weight=11
    //% group="Setting"
    export function setVolume(volume: number) {
        // DFRobotDFPlayerMini::volume(uint8_t volume)
        innerCall(0x06, 0x00, volume);

        serial.redirectToUSB();
    }

    /**
     * Adjust the EQ of the sound
     * @param chooseEQ select EQ format
     */
    //% block="M11 MP3 Player \\| Set EQ $chooseEQ from port (P2+P8)"
    //% chooseEQ.defl=mp3Player.EQ.Normal
    //% inlineInputMode=inline
    //% weight=10
    //% group="Setting"
    export function setEQ(chooseEQ: EQ) {
        // DFRobotDFPlayerMini::EQ(uint8_t eq)
        innerCall(0x07, 0x00, chooseEQ);

        serial.redirectToUSB();
    }

    /**
     * Play the music file of your choice
     * @param file select the music file you want to play
     */
    //% block="M11 MP3 Player \\| Play file number $file from port (P2+P8)"
    //% file.defl=1 file.min=0 file.max=65535
    //% inlineInputMode=inline
    //% weight=9
    //% group="Control"
    export function playFile(file: number) {
        /**
         * Play specific mp3 in SD:/MP3/0000.mp3; File Name (0 ~ 65,535)
         * DFRobotDFPlayerMini::playMp3Folder(int fileNumber)
         */
        innerCall(0x12, file >> 8, file & 0xFF);

        serial.redirectToUSB();
    }

    /**
     * Play the next or previous music file compared to the current music file
     * @param playWhat choose to play next or previous music file
     */
    //% block="M11 MP3 Player \\| Play $playWhat from port (P2+P8)"
    //% playWhat.defl=mp3Player.PlayWhat.Next
    //% inlineInputMode=inline
    //% weight=8
    //% group="Control"
    export function play(playWhat: PlayWhat) {
        /**
         * DFRobotDFPlayerMini::next()
         * DFRobotDFPlayerMini::previous()
         */
        innerCall(playWhat, 0x00, 0x00);

        serial.redirectToUSB();
    }

    /**
     * Pause the currently playing file
     */
    //% block="M11 MP3 Player \\| Pause from port (P2+P8)"
    //% inlineInputMode=inline
    //% weight=7
    //% group="Control"
    export function pause() {
        // DFRobotDFPlayerMini::pause()
        innerCall(0x0E, 0x00, 0x00);

        serial.redirectToUSB();
    }

    /**
     * Play continues with paused file music
     */
    //% block="M11 MP3 Player \\| Start (Play continues) from port (P2+P8)"
    //% inlineInputMode=inline
    //% weight=6
    //% group="Control"
    export function start() {
        // DFRobotDFPlayerMini::start()
        innerCall(0x0D, 0x00, 0x00);

        serial.redirectToUSB();
    }

    /**
     * Get the parameters being set in MP3 Player
     */
    //% block="M11 MP3 Player \\| Read information setting current from port (P2+P8)"
    //% inlineInputMode=inline
    //% weight=5
    //% group="Get Info"
    export function getInfo(): string {
        return getInfoMP3();
    }

    /**
     * Play a music file of your choice for a certain amount of time
     * @param file select the music file you want to play
     * @param second set how long you want to play that file
     */
    //% block="M11 MP3 Player \\| Play file number $file for $second seconds from port (P2+P8)"
    //% file.defl=1 file.min=0 file.max=65535
    //% second.defl=2.5
    //% inlineInputMode=inline
    //% weight=4
    //% group="Advanced Control"
    export function playFileInTime(file: number, second: number) {
        playFile(file);
        playInPeriod(second);

        serial.redirectToUSB();
    }

    /**
     * Play the music file of your choice until the song is over
     * @param file select the music file you want to play
     */
    //% block="M11 MP3 Player \\| Play file number $file until done from port (P2+P8)"
    //% file.defl=1 file.min=0 file.max=65535
    //% inlineInputMode=inline
    //% weight=3
    //% group="Advanced Control"
    export function playFileUntilDone(file: number) {
        /**
         * Play specific mp3 in SD:/MP3/0000.mp3; File Name (0 ~ 65,535)
         * DFRobotDFPlayerMini::playMp3Folder(int fileNumber)
         */
        innerCall(0x12, file >> 8, file & 0xFF);
        waitFinishMusic();

        serial.redirectToUSB();
    }

    /**
     * Play next or previous music file for a certain amount of time
     * @param playWhat choose to play next or previous music file
     * @param second set how long you want to play that file
     */
    //% block="M11 MP3 Player \\| Play $playWhat for $second seconds from port (P2+P8)"
    //% playWhat.defl=mp3Player.PlayWhat.Next
    //% second.defl=2.5
    //% inlineInputMode=inline
    //% weight=2
    //% group="Advanced Control"
    export function playInTime(playWhat: PlayWhat, second: number) {
        play(playWhat);
        playInPeriod(second);

        serial.redirectToUSB();
    }

    /**
     * Play next or previous music file until the song is over
     * @param playWhat choose to play next or previous music file
     */
    //% block="M11 MP3 Player \\| Play $playWhat until done from port (P2+P8)"
    //% playWhat.defl=mp3Player.PlayWhat.Next
    //% inlineInputMode=inline
    //% weight=1
    //% group="Advanced Control"
    export function playUntilDone(playWhat: PlayWhat) {
        /**
         * DFRobotDFPlayerMini::next()
         * DFRobotDFPlayerMini::previous()
         */
        innerCall(playWhat, 0x00, 0x00);
        waitFinishMusic();

        serial.redirectToUSB();
    }
}
