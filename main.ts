basic.forever(function () {
	
})

//% color="#FEBC68" weight=5 icon="\uf001" block="M10"
//% groups="['Get Info Time (Data)', 'Get Info Time (Text)', 'Setting Time', 'Alarm']"
namespace Line {
    export enum Calendar {
        //% block="Day"
        Day = 0,
        //% block="Month"
        Month = 1,
        //% block="Year"
        Year = 2
    }

    export enum Clock {
        //% block="Hour"
        Hour = 0,
        //% block="Minute"
        Minute = 1,
        //% block="Second"
        Second = 2
    }

    export enum Month {
        //% block="Jan"
        Jan = 1,
        //% block="Feb"
        Feb = 2,
        //% block="Mar"
        Mar = 3,
        //% block="Apr"
        Apr = 4,
        //% block="May"
        May = 5,
        //% block="Jun"
        Jun = 6,
        //% block="Jul"
        Jul = 7,
        //% block="Aug"
        Aug = 8,
        //% block="Sep"
        Sep = 9,
        //% block="Oct"
        Oct = 10,
        //% block="Nov"
        Nov = 11,
        //% block="Dec"
        Dec = 12
    }

    export enum Alarm {
        //% block="one time"
        OneTime = 1,
        //% block="always"
        Always = 0
    }

    /**
     * Note: the value "Day of the Week" store in DS3231
     * Have value from [1 - 7], with value 1 mean Sunday, 2 is Monday, and so on ...
     * 
     *      ENUM - DS3231  - ISO_8601 (the Week begin Monday, not Sunday)
     * Sun  0    - 1       - 7
     * Mon  1    - 2       - 1
     * Tue  2    - 3       - 2
     * Wed  3    - 4       - 3
     * Thu  4    - 5       - 4
     * Fri  5    - 6       - 5
     * Sat  6    - 7       - 6
     */
    export enum DayOfWeek {
        Sun, Mon, Tue, Wed, Thu, Fri, Sat
    }

    const alarm: number[] = [-1, -1];   // [Hour:Minute]
    let typeAlarm = Alarm.OneTime;      // Alarm one time!

    /* --------------------------------------------------------------------- */

    const DS3231_I2C_ADDR = 0x68; // Fixed I2C address

    const DS3231_REG_SECOND = 0x00;
    const DS3231_REG_MINUTE = 0x01;
    const DS3231_REG_HOUR = 0x02;
    const DS3231_REG_DAY = 0x03;
    const DS3231_REG_DATE = 0x04;
    const DS3231_REG_MONTH = 0x05;
    const DS3231_REG_YEAR = 0x06;

    /* --------------------------------------------------------------------- */

    /* Set a DS3231 reg */
    export function setReg(reg: number, dat: number) {
        let buf = pins.createBuffer(2);

        buf[0] = reg;
        buf[1] = dat;

        pins.i2cWriteBuffer(DS3231_I2C_ADDR, buf);
    }

    /* Get a DS3231 reg value */
    export function regValue(reg: number): number {
        pins.i2cWriteNumber(DS3231_I2C_ADDR, reg, NumberFormat.UInt8LE);

        return pins.i2cReadNumber(DS3231_I2C_ADDR, NumberFormat.UInt8LE);
    }

    /* --------------------------------------------------------------------- */

    /**
     * Convert a "Binary Coded Decimal" value to Binary
     * 
     * RTC stores time/date values as BCD
     * 
     * Old Recipe:  ( BCD >> 4 ) * 10 + ( BCD & 0x0F )
     * New Recipe:  BCD - 6 * ( BCD >> 4 )
     */
    export function bcdToDec(bcd: number): number {
        return bcd - 6 * (bcd >> 4);
    }

    /**
     * Convert a Binary value to BCD format for the RTC registers
     * 
     * The format BCD does not store value DEC in normal format of Binary
     * It use 4 bit corresponding for 10 digit "0-9" that is 10 number from "0-9"
     * With 4bit MSB for "Digit x10", and 4 bit LSB for "Digit x1"
     * 
     * Old Recipe:  ( ( DEC / 10 ) << 4 ) + ( DEC % 10 )
     * New Recipe:  DEC + 6 * ( DEC / 10 )
     */
    export function decToBcd(dec: number): number {
        return dec + 6 * Math.idiv(dec, 10);
    }

    /* --------------------------------------------------------------------- */

    /**
     * To determine this "Date" of Month of Year is what "Day of the Week"?
     * The Week begin Sunday with number 0
     * 
     * Way Tomohiko Sakamoto's used the "Doomsday Algorithm" to determine the Day of the Week!
     */
    export function getDayOfWeek(y: number, m: number, d: number): number {
        const monthTable: number[] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

        y -= ((m < 3) ? 1 : 0);

        return ((y + Math.idiv(y, 4) - Math.idiv(y, 100) + Math.idiv(y, 400) + monthTable[m - 1] + d) % 7);
    }

    /**
     * Mapping the value "Day" from "Tomohiko Sakamoto" to "ISO_8601"
     */
    export function getDS3231DayOfWeek(y: number, m: number, d: number): number {
        switch (getDayOfWeek(y, m, d)) {
            case DayOfWeek.Sun: return 1;
            case DayOfWeek.Mon: return 2;
            case DayOfWeek.Tue: return 3;
            case DayOfWeek.Wed: return 4;
            case DayOfWeek.Thu: return 5;
            case DayOfWeek.Fri: return 6;
            case DayOfWeek.Sat: return 7;
            default: return 0;
        }
    }

    /* --------------------------------------------------------------------- */

    //% shim=ds3231::get_DATE
    export function get_DATE(): string {
        return "?";
    }

    //% shim=ds3231::get_TIME
    export function get_TIME(): string {
        return "?";
    }

    //! Use for Debug
    // //% block="DS3231 \\| Print DATE"
    // export function print_DATE(): string {
    //     return get_DATE();
    // }

    //! Use for Debug
    // //% block="DS3231 \\| Print TIME"
    // export function print_TIME(): string {
    //     return get_TIME();
    // }

    /* --------------------------------------------------------------------- */

    /**
     * Get Day, Month, Year data from DS3231
     * @param calendar select get data Day, Month or Year
     */
    //% block="M09 Clock I2C \\| Get $calendar in Calendar"
    //% calendar.defl=ds3231.Calendar.Day
    //% inlineInputMode=inline
    //% weight=11
    //% group="Get Info Time (Data)"
    export function getDayMonthYear(calendar: Calendar): number {
        switch (calendar) {
            case Calendar.Day: return bcdToDec(regValue(DS3231_REG_DATE));
            case Calendar.Month: return bcdToDec(regValue(DS3231_REG_MONTH));
            case Calendar.Year: return bcdToDec(regValue(DS3231_REG_YEAR)) + 2000;
        }
    }

    /**
     * Get "Date of Week" data from DS3231
     */
    //% block="M09 Clock I2C \\| Get Days of the Week"
    //% inlineInputMode=inline
    //% weight=10
    //% group="Get Info Time (Data)"
    export function getDate(): string {
        switch (regValue(DS3231_REG_DAY)) {
            case 1: return "Sun";
            case 2: return "Mon";
            case 3: return "Tue";
            case 4: return "Wed";
            case 5: return "Thu";
            case 6: return "Fri";
            case 7: return "Sat";
            default: return "---";
        }
    }

    /**
     * Get Hour, Minute, Second data from DS3231
     * @param clock select get data Hour, Minute or Second
     */
    //% block="M09 Clock I2C \\| Get $clock in Time now"
    //% clock.defl=ds3231.Clock.Hour
    //% inlineInputMode=inline
    //% weight=9
    //% group="Get Info Time (Data)"
    export function getHourMinuteSecond(clock: Clock): number {
        switch (clock) {
            case Clock.Hour: return bcdToDec(regValue(DS3231_REG_HOUR));
            case Clock.Minute: return bcdToDec(regValue(DS3231_REG_MINUTE));
            case Clock.Second: return bcdToDec(regValue(DS3231_REG_SECOND));
        }
    }

    /**
     * Get aggregated __DATE__ data
     */
    //% block="M09 Clock I2C \\| Get Calendar"
    //% inlineInputMode=inline
    //% weight=8
    //% group="Get Info Time (Text)"
    export function getCalendar(): string {
        let d = bcdToDec(regValue(DS3231_REG_DATE));
        let m = bcdToDec(regValue(DS3231_REG_MONTH));
        let y = bcdToDec(regValue(DS3231_REG_YEAR)) + 2000;

        let t = "";
        t = t + getDate() + ",";
        (d < 10) ? (t = t + "0" + convertToText(d) + "/") : (t = t + convertToText(d) + "/");
        (m < 10) ? (t = t + "0" + convertToText(m) + "/") : (t = t + convertToText(m) + "/");
        t += y;

        return t;
    }

    /**
     * Get aggregated __TIME__ data
     */
    //% block="M09 Clock I2C \\| Get Time now"
    //% inlineInputMode=inline
    //% weight=7
    //% group="Get Info Time (Text)"
    export function getTime(): string {
        let h = bcdToDec(regValue(DS3231_REG_HOUR));
        let m = bcdToDec(regValue(DS3231_REG_MINUTE));
        let s = bcdToDec(regValue(DS3231_REG_SECOND));

        let t = "";
        (h < 10) ? (t = t + "0" + convertToText(h) + ":") : (t = t + convertToText(h) + ":");
        (m < 10) ? (t = t + "0" + convertToText(m) + ":") : (t = t + convertToText(m) + ":");
        (s < 10) ? (t = t + "0" + convertToText(s)) : (t = t + convertToText(s));

        return t;
    }

    // /**
    //  * !
    //  */
    // //% block="DS3231 \\| Set Date & Time this sketch was compiled"
    // //% inlineInputMode=inline
    // //% weight=6
    // //% group="Setting Time"
    // export function setTime_byCompiled() {
    //     let s = "";

    //     s = get_DATE(); // mmm dd yyyy
    //     let DATE = s.split(" ");
    //     s = get_TIME(); // hh:mm:ss
    //     let TIME = s.split(":");

    //     //! Use for Debug
    //     // serial.writeLine(DATE[1] + "-" + DATE[0] + "-" + DATE[2]);
    //     // serial.writeLine(TIME[0] + ":" + TIME[1] + ":" + TIME[2]);

    //     /* ----------------------------------------------------------------- */

    //     let buf = pins.createBuffer(8);

    //     buf[0] = DS3231_REG_SECOND;
    //     buf[1] = decToBcd(parseInt(TIME[2]));
    //     buf[2] = decToBcd(parseInt(TIME[1]));
    //     buf[3] = decToBcd(parseInt(TIME[0]));
    //     buf[4] = decToBcd(getDS3231DayOfWeek(y, m, d));
    //     buf[5] = decToBcd(d);
    //     buf[6] = decToBcd(m);
    //     buf[7] = decToBcd(y - 2000);

    //     pins.i2cWriteBuffer(DS3231_I2C_ADDR, buf);
    // }

    /**
     * Date & Time settings for DS3231
     * @param day choose Day
     * @param month choose Month
     * @param year choose Year
     * @param hour choose Hour
     * @param minute choose Minute
     */
    //% block="M09 Clock I2C \\| Set Day $day Month $month Year $year, $hour Hour : $minute Minute : 0 Second"
    //% day.defl=1 day.min=1 day.max=31
    //% month.defl=ds3231.Month.Jan
    //% year.defl=2022 year.min=2000 year.max=2099
    //% hour.defl=11 hour.min=0 hour.max=23
    //% minute.defl=30 minute.min=0 minute.max=59
    //% inlineInputMode=inline
    //% weight=5
    //% group="Setting Time"
    export function setTime_byChoose(day: number, month: Month, year: number, hour: number, minute: number) {
        let buf = pins.createBuffer(8);

        buf[0] = DS3231_REG_SECOND;
        buf[1] = decToBcd(0);
        buf[2] = decToBcd(minute);
        buf[3] = decToBcd(hour);
        buf[4] = decToBcd(getDS3231DayOfWeek(year, month, day));
        buf[5] = decToBcd(day);
        buf[6] = decToBcd(month);
        buf[7] = decToBcd(year - 2000);

        pins.i2cWriteBuffer(DS3231_I2C_ADDR, buf);
    }

    /**
     * Set the Date & Time for the DS3231 using the command
     * @param setFullTime install by command according to the syntax "ST-dd/mm/yyyy-hh:mm:ss"
     */
    //% block="M09 Clock I2C \\| Setting Date & Time $setFullTime"
    //% setFullTime.defl="ST-15/08/2022-13:13:13"
    //% inlineInputMode=inline
    //% weight=4
    //% group="Setting Time"
    export function setTime_byCommands(setFullTime: string): boolean {
        /**
         * String handling:
         * 
         * The command SetTime input correct is: ST-00/00/0000-00:00:00
         * With value sequence is: ST-Day/Month/Year-Hour:Minute:Second
         */
        if (setFullTime.length == 22) {
            if (setFullTime.includes("ST")) {
                if (setFullTime[2] != '-') return false;
                if (setFullTime[5] != '/') return false;
                if (setFullTime[8] != '/') return false;
                if (setFullTime[13] != '-') return false;
                if (setFullTime[16] != ':') return false;
                if (setFullTime[19] != ':') return false;

                let day = parseInt(setFullTime.substr(3, 2));
                let month = parseInt(setFullTime.substr(6, 2));
                let year = parseInt(setFullTime.substr(9, 4));

                let hour = parseInt(setFullTime.substr(14, 2));
                let minute = parseInt(setFullTime.substr(17, 2));
                let second = parseInt(setFullTime.substr(20, 2));

                /* --------------------------------------------------------- */

                let buf = pins.createBuffer(8);

                buf[0] = DS3231_REG_SECOND;
                buf[1] = decToBcd(second);
                buf[2] = decToBcd(minute);
                buf[3] = decToBcd(hour);
                buf[4] = decToBcd(getDS3231DayOfWeek(year, month, day));
                buf[5] = decToBcd(day);
                buf[6] = decToBcd(month);
                buf[7] = decToBcd(year - 2000);

                pins.i2cWriteBuffer(DS3231_I2C_ADDR, buf);
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    /**
     * Alarm settings for DS3231
     * @param hour choose Hour
     * @param minute choose Minute
     * @param types alarm once or every day
     */
    //% block="M09 Clock I2C \\| Set Alarm at $hour Hour : $minute Minute $types"
    //% hour.defl=11 hour.min=0 hour.max=23
    //% minute.defl=30 minute.min=0 minute.max=59
    //% types.defl=ds3231.Alarm.OneTime
    //% inlineInputMode=inline
    //% weight=3
    //% group="Alarm"
    //% blockHidden=true
    export function setAlarm_byChoose(hour: number, minute: number, types: Alarm) {
        alarm[0] = hour;
        alarm[1] = minute;
        typeAlarm = types;
    }

    /**
     * Set the Alarm for the DS3231 using the command
     * @param ticks install by command according to the syntax "ST-hh:mm"
     * @param types alarm once or every day
     */
    //% block="M09 Clock I2C \\| Setting Alarm $ticks $types"
    //% ticks.defl="SA-15:30"
    //% types.defl=ds3231.Alarm.OneTime
    //% inlineInputMode=inline
    //% weight=2
    //% group="Alarm"
    //% blockHidden=true
    export function setAlarm_byCommands(ticks: string, types: Alarm): boolean {
        /**
         * String handling:
         * 
         * The command SetTime input correct is: SA-00:00
         * With value sequence is: SA-Hour:Minute
         */
        if (ticks.length == 8) {
            if (ticks.includes("SA")) {
                if (ticks[2] != '-') return false;
                if (ticks[5] != ':') return false;

                alarm[0] = parseInt(ticks.substr(3, 2));
                alarm[1] = parseInt(ticks.substr(6, 2));
                typeAlarm = types;

                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    /**
     * Update the time to see if it's time for the alarm
     */
    //% block="M09 Clock I2C \\| Check Alarm 💤⏰"
    //% inlineInputMode=inline
    //% weight=1
    //% group="Alarm"
    //% blockHidden=true
    export function checkAlarm(): boolean {
        if (bcdToDec(regValue(DS3231_REG_HOUR)) == alarm[0]) {
            if (bcdToDec(regValue(DS3231_REG_MINUTE)) == alarm[1]) {
                if (typeAlarm == 1) {   // OneTime
                    alarm[0] = alarm[1] = -1;
                }
                return true;
            }
            else {
                return false;
            }
        }
        else {
            return false;
        }
    }
    
}

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
