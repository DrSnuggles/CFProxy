/*
Advanced proxy by DrSnuggles using a cloudflare worker
Vectrexer had the nice idea to also load ZIP/RAR/7Z content
I was first thinking of doing that client side
but since Vectrexer requested this feature for URLs i will do here
and deliver depacked content to vecx

Since i do not know if we have a valid rom/bios/png/...
i will try to decrunch first, sorry cloudflare...

based on https://github.com/imaya/zlib.js

working 200:404... https://gitcdn.xyz/repo/drsnuggles/drsnuggles.github.io/master/jsvecx/roms/Commercial/MineStorm.bin
working raw https://docs.google.com/uc?export=download&id=1zBvCN6Ap9723LGDcXNonXFppOsaW2Mu4

MineStorm.zip
https://drive.google.com/open?id=1WcrVSDBkcIsfVZFnMRdJFxXMLdNTzW1r
https://docs.google.com/uc?export=download&id=1WcrVSDBkcIsfVZFnMRdJFxXMLdNTzW1r

http://www.amigaremix.com/files/3266/Odkin_-_Dyna_Blaster_ingame.mp3
http://www.amigaremix.com/files/3266/Odkin%20-%20Dyna Blaster ingame.mp3
http://remix.kwed.org/download.php/6115/Fabian%20del%20Priore%20-%20Traz%20%28Rapture%20Remix%29.mp3

Goal: http://www.herbs64.plus.com/files/py050712.zip

not working:
https://cdn.jsdelivr.net/gh/DrSnuggles/DrSnuggles.github.io/jsvecx/roms/Commercial/Mine%20Storm.bin
https://drsnuggles.github.io/jsvecx/roms/Commercial/Mine%20Storm.bin
https://drsnuggles.github.io/jsvecx/roms/Commercial/Mine%20Storm.zip
https://web.archive.org/web/20191127231243/http://eitidaten.fh-pforzheim.de/daten/mitarbeiter/johannsen/vectrex_2019/download/vec_man_rc24.bin
*/

//
// Vars
//
var debug = true
var maxSize = 256 * 1024 // 256kB

//
// Listener
//
addEventListener('fetch', event => {
  console.clear()
  event.respondWith( handleRequest(event.request) )
})

//
// Answerer
//
async function handleRequest(req) {
  if (debug) {
    console.log(req)
  }

  var src = req.headers.get("Origin")
  src = (typeof src !== "string") ? "" : src
  src = src.toLowerCase()

  // Make the headers mutable by re-constructing the Request.
  //req = new Request( req )
  //req.headers.set('Access-Control-Allow-Origin', '*')

  var dst = new URL(req.url)
  dst = unescape( unescape( dst.search.substr(1) ) )
  if (dst.length === 0) return nope(src, dst) // no dst set

  // filter... the overlay <img src="..." has null
  if (1===1 || src.indexOf("https://drsnuggles.github.io") === 0 || src.indexOf("https://mstest.net") === 0) {
    return recFetch(dst, req)
    .then(res => {
      //if (debug) console.log(res)
      //return new Response(res)
      return decrunchTry(res, src, dst)
      .then(res => {
        if (debug) console.log(res)
        if (res) {
          return res
        } else {
          return nope(src, dst)
        }
        
      })
    }).catch(e => {
      console.error(e)
    })





/*


    // allowed
    await fetch(dst, req).then(async function(res){

      // error handling
      switch (res.status) {
        case 302: // temp. moved => follow
          dst = res.headers.get("location")
          res = await fetch(dst, req)
          break
        default:
          break
      }

      // use reader
      var reader = res.body.getReader()
      var chunk = await reader.read() // we are not really sure if it's compressed or not
      var arr = [];
      while (!chunk.done) {
        for (let i = 0; i < chunk.value.length; i++) {
          arr.push(chunk.value[i]);
        }
        chunk = await reader.read()
      }
      reader.releaseLock();

      if (arr.length > 4*48*1024) nope(src,dst) // file to large (bankswitched 4x48kB = max)

      // depack / inflate / decrunch / unzip
      //if (debug) console.log(arr)
      try {
        var inflate = new Zlib.Inflate(arr)
        var plain = await inflate.decompress()
        // need a zip to test
        res = new Response()

      } catch(e) {
        //if (debug) console.log("This file wasn't zipped")
        // if we cannot decrunch we expect already decompressed data
        //if (debug) console.log(e);
        var buf = new ArrayBuffer(arr)
        var td = new TextDecoder()
        var stream = td.decode(buf) // now without await, we waited long enough....

        var meta = {"status": 200, "statusText": "OK" }
        var res = new Response(stream, meta)
      }

      //
      // Exit
      //
      //if (debug) console.log(res)
      return res

    })
*/

  } else {
    // not allowed
    return nope(src, dst)
    //.then(ret =>{
    //  return ret
    //})
  }
}

//
// recursive Fetch
//
async function recFetch(dst, req) {
  if (debug) console.log("recFetch", dst, req)
  return fetch(dst, req)
    .then(res => {
      if (debug) console.log("got status:", res.status, res.statusText)
      // error handling
      switch (res.status) {
        case 301: // perm. moved => follow
        case 302: // temp. moved => follow
          dst = res.headers.get("location")
          //if (debug) console.log(dst)
          return recFetch(dst, req)
          .then(res => {
            //if (debug) console.log(res)
            return res
          }).catch(e =>{
            console.error(e)
          })
          break
        case 200:
          if (debug) console.log("200", res)
          return res
          break;
        default:
          console.error(res)
          //return false
          //return new Response(res) // new sets status 200
          return res
          break
      }
    })
    .catch(e => {
      console.error(e)
    })
}

//
// negative Response
//
async function nope(src, dst){
  if (debug) {
    console.log("nope")
    return new Response("The use of this proxy is restricted",{status: 403, statusText: 'Forbidden', headers: {"Content-Type": "text/html", "src": src, "dst": dst}})
  } else {
    return new Response("The use of this proxy is restricted",{status: 403, statusText: 'Forbidden', headers: {"Content-Type": "text/html"}})
  }
}

//
// decrunch Try
//
async function decrunchTry(res, src, dst){
  if (debug) console.log("decrunchTry")
  if (!res) return nope(src, dst)
  if (debug) console.log("decrunchTry2")
  //var zipped = false

  // use reader
  var reader = res.body.getReader()
  var chunk = await reader.read() // we are not really sure if it's compressed or not

  // quick req if zipped or not. first two chars = PK
  if (!(chunk.value[0] !== "P" || chunk.value[1] !== "K")) {
    if (debug) console.log("no PK file found in:", chunk)
    return nope(src, dst)
  }

  var arr = [];
  while (!chunk.done) {
    for (let i = 0; i < chunk.value.length; i++) {
      arr.push(chunk.value[i]);
    }

    // filter
    if (arr.length > maxSize) {
      if (debug) console.log("File to large than: ", maxSize)
      return nope(src,dst) // file to large
    }

    chunk = await reader.read()
  }
  reader.releaseLock();
  if (debug) console.log("decrunchTry3")


  // identify known formats
  //if (debug) console.log(arr)

  // depack / inflate / decrunch / unzip
  var buf = new Uint8Array(arr).buffer;
  try {
    var inflate = new Zlib.Inflate(buf)
    var plain = await inflate.decompress()
    // need a zip to test
    res = new Response()

  } catch(e) {
    console.error(e)
    if (debug) console.log("This file wasn't zipped")


    // if we cannot decrunch we expect already decompressed data
    //if (debug) console.log(e);
    //var buf = new Uint8Array(arr).buffer;
    var td = new TextDecoder()
    var stream = td.decode(buf) // now without await, we waited long enough....
    var meta = {"status": res.status, "statusText": res.statusText }
    var res = new Response(stream, meta)

    //
    // Exit
    //
    //if (debug) console.log(stream)
    return res

  }

}

//
// Helper functions
//

//
// blow this is all copied from other sources
//
var Zlib = {
  Util:    {},
  Huffman: {},
  RawInflate: {},
  CompressionMethod: {
    DEFLATE: 8,  
  }
}
var USE_TYPEDARRAY = true

/**
 * @license
 * zlib.js
 * JavaScript Zlib Library
 * https://github.com/imaya/zlib.js
 *
 * The MIT License
 *
 * Copyright (c) 2012 imaya
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


/**
 * Byte String から Byte Array に変換.
 * @param {!string} str byte string.
 * @return {!Array.<number>} byte array.
 */
Zlib.Util.stringToByteArray = function(str) {
  /** @type {!Array.<(string|number)>} */
  var tmp = str.split('');
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = tmp.length; i < il; i++) {
    tmp[i] = (tmp[i].charCodeAt(0) & 0xff) >>> 0;
  }

  return tmp;
};



/**
 * Adler32 ハッシュ値の作成
 * @param {!(Array|Uint8Array|string)} array 算出に使用する byte array.
 * @return {number} Adler32 ハッシュ値.
 */
Zlib.Adler32 = function(array) {
  if (typeof(array) === 'string') {
    array = Zlib.Util.stringToByteArray(array);
  }
  return Zlib.Adler32.update(1, array);
};

/**
 * Adler32 ハッシュ値の更新
 * @param {number} adler 現在のハッシュ値.
 * @param {!(Array|Uint8Array)} array 更新に使用する byte array.
 * @return {number} Adler32 ハッシュ値.
 */
Zlib.Adler32.update = function(adler, array) {
  /** @type {number} */
  var s1 = adler & 0xffff;
  /** @type {number} */
  var s2 = (adler >>> 16) & 0xffff;
  /** @type {number} array length */
  var len = array.length;
  /** @type {number} loop length (don't overflow) */
  var tlen;
  /** @type {number} array index */
  var i = 0;

  while (len > 0) {
    tlen = len > Zlib.Adler32.OptimizationParameter ?
      Zlib.Adler32.OptimizationParameter : len;
    len -= tlen;
    do {
      s1 += array[i++];
      s2 += s1;
    } while (--tlen);

    s1 %= 65521;
    s2 %= 65521;
  }

  return ((s2 << 16) | s1) >>> 0;
};

/**
 * Adler32 最適化パラメータ
 * 現状では 1024 程度が最適.
 * @see http://jsperf.com/adler-32-simple-vs-optimized/3
 * @define {number}
 */
Zlib.Adler32.OptimizationParameter = 1024;




/**
 * build huffman table from length list.
 * @param {!(Array.<number>|Uint8Array)} lengths length list.
 * @return {!Array} huffman table.
 */
Zlib.Huffman.buildHuffmanTable = function(lengths) {
  /** @type {number} length list size. */
  var listSize = lengths.length;
  /** @type {number} max code length for table size. */
  var maxCodeLength = 0;
  /** @type {number} min code length for table size. */
  var minCodeLength = Number.POSITIVE_INFINITY;
  /** @type {number} table size. */
  var size;
  /** @type {!(Array|Uint8Array)} huffman code table. */
  var table;
  /** @type {number} bit length. */
  var bitLength;
  /** @type {number} huffman code. */
  var code;
  /**
   * サイズが 2^maxlength 個のテーブルを埋めるためのスキップ長.
   * @type {number} skip length for table filling.
   */
  var skip;
  /** @type {number} reversed code. */
  var reversed;
  /** @type {number} reverse temp. */
  var rtemp;
  /** @type {number} loop counter. */
  var i;
  /** @type {number} loop limit. */
  var il;
  /** @type {number} loop counter. */
  var j;
  /** @type {number} table value. */
  var value;

  // Math.max は遅いので最長の値は for-loop で取得する
  for (i = 0, il = listSize; i < il; ++i) {
    if (lengths[i] > maxCodeLength) {
      maxCodeLength = lengths[i];
    }
    if (lengths[i] < minCodeLength) {
      minCodeLength = lengths[i];
    }
  }

  size = 1 << maxCodeLength;
  table = new (USE_TYPEDARRAY ? Uint32Array : Array)(size);

  // ビット長の短い順からハフマン符号を割り当てる
  for (bitLength = 1, code = 0, skip = 2; bitLength <= maxCodeLength;) {
    for (i = 0; i < listSize; ++i) {
      if (lengths[i] === bitLength) {
        // ビットオーダーが逆になるためビット長分並びを反転する
        for (reversed = 0, rtemp = code, j = 0; j < bitLength; ++j) {
          reversed = (reversed << 1) | (rtemp & 1);
          rtemp >>= 1;
        }

        // 最大ビット長をもとにテーブルを作るため、
        // 最大ビット長以外では 0 / 1 どちらでも良い箇所ができる
        // そのどちらでも良い場所は同じ値で埋めることで
        // 本来のビット長以上のビット数取得しても問題が起こらないようにする
        value = (bitLength << 16) | i;
        for (j = reversed; j < size; j += skip) {
          table[j] = value;
        }

        ++code;
      }
    }

    // 次のビット長へ
    ++bitLength;
    code <<= 1;
    skip <<= 1;
  }

  return [table, maxCodeLength, minCodeLength];
};




/**
 * @constructor
 * @param {!(Uint8Array|Array.<number>)} input input buffer.
 * @param {Object} opt_params option parameter.
 *
 * opt_params は以下のプロパティを指定する事ができます。
 *   - index: input buffer の deflate コンテナの開始位置.
 *   - blockSize: バッファのブロックサイズ.
 *   - bufferType: Zlib.RawInflate.BufferType の値によってバッファの管理方法を指定する.
 *   - resize: 確保したバッファが実際の大きさより大きかった場合に切り詰める.
 */
Zlib.RawInflate = function(input, opt_params) {
  /** @type {!(Array.<number>|Uint8Array)} inflated buffer */
  this.buffer;
  /** @type {!Array.<(Array.<number>|Uint8Array)>} */
  this.blocks = [];
  /** @type {number} block size. */
  this.bufferSize = ZLIB_RAW_INFLATE_BUFFER_SIZE;
  /** @type {!number} total output buffer pointer. */
  this.totalpos = 0;
  /** @type {!number} input buffer pointer. */
  this.ip = 0;
  /** @type {!number} bit stream reader buffer. */
  this.bitsbuf = 0;
  /** @type {!number} bit stream reader buffer size. */
  this.bitsbuflen = 0;
  /** @type {!(Array.<number>|Uint8Array)} input buffer. */
  this.input = USE_TYPEDARRAY ? new Uint8Array(input) : input;
  /** @type {!(Uint8Array|Array.<number>)} output buffer. */
  this.output;
  /** @type {!number} output buffer pointer. */
  this.op;
  /** @type {boolean} is final block flag. */
  this.bfinal = false;
  /** @type {Zlib.RawInflate.BufferType} buffer management. */
  this.bufferType = Zlib.RawInflate.BufferType.ADAPTIVE;
  /** @type {boolean} resize flag for memory size optimization. */
  this.resize = false;

  // option parameters
  if (opt_params || !(opt_params = {})) {
    if (opt_params['index']) {
      this.ip = opt_params['index'];
    }
    if (opt_params['bufferSize']) {
      this.bufferSize = opt_params['bufferSize'];
    }
    if (opt_params['bufferType']) {
      this.bufferType = opt_params['bufferType'];
    }
    if (opt_params['resize']) {
      this.resize = opt_params['resize'];
    }
  }

  // initialize
  switch (this.bufferType) {
    case Zlib.RawInflate.BufferType.BLOCK:
      this.op = Zlib.RawInflate.MaxBackwardLength;
      this.output =
        new (USE_TYPEDARRAY ? Uint8Array : Array)(
          Zlib.RawInflate.MaxBackwardLength +
          this.bufferSize +
          Zlib.RawInflate.MaxCopyLength
        );
      break;
    case Zlib.RawInflate.BufferType.ADAPTIVE:
      this.op = 0;
      this.output = new (USE_TYPEDARRAY ? Uint8Array : Array)(this.bufferSize);
      break;
    default:
      throw new Error('invalid inflate mode');
  }
};

/**
 * @enum {number}
 */
Zlib.RawInflate.BufferType = {
  BLOCK: 0,
  ADAPTIVE: 1
};

/**
 * decompress.
 * @return {!(Uint8Array|Array.<number>)} inflated buffer.
 */
Zlib.RawInflate.prototype.decompress = function() {
  while (!this.bfinal) {
    this.parseBlock();
  }

  switch (this.bufferType) {
    case Zlib.RawInflate.BufferType.BLOCK:
      return this.concatBufferBlock();
    case Zlib.RawInflate.BufferType.ADAPTIVE:
      return this.concatBufferDynamic();
    default:
      throw new Error('invalid inflate mode');
  }
};

/**
 * @const
 * @type {number} max backward length for LZ77.
 */
Zlib.RawInflate.MaxBackwardLength = 32768;

/**
 * @const
 * @type {number} max copy length for LZ77.
 */
Zlib.RawInflate.MaxCopyLength = 258;

/**
 * huffman order
 * @const
 * @type {!(Array.<number>|Uint8Array)}
 */
Zlib.RawInflate.Order = (function(table) {
  return USE_TYPEDARRAY ? new Uint16Array(table) : table;
})([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);

/**
 * huffman length code table.
 * @const
 * @type {!(Array.<number>|Uint16Array)}
 */
Zlib.RawInflate.LengthCodeTable = (function(table) {
  return USE_TYPEDARRAY ? new Uint16Array(table) : table;
})([
  0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0x0008, 0x0009, 0x000a, 0x000b,
  0x000d, 0x000f, 0x0011, 0x0013, 0x0017, 0x001b, 0x001f, 0x0023, 0x002b,
  0x0033, 0x003b, 0x0043, 0x0053, 0x0063, 0x0073, 0x0083, 0x00a3, 0x00c3,
  0x00e3, 0x0102, 0x0102, 0x0102
]);

/**
 * huffman length extra-bits table.
 * @const
 * @type {!(Array.<number>|Uint8Array)}
 */
Zlib.RawInflate.LengthExtraTable = (function(table) {
  return USE_TYPEDARRAY ? new Uint8Array(table) : table;
})([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0, 0, 0
]);

/**
 * huffman dist code table.
 * @const
 * @type {!(Array.<number>|Uint16Array)}
 */
Zlib.RawInflate.DistCodeTable = (function(table) {
  return USE_TYPEDARRAY ? new Uint16Array(table) : table;
})([
  0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0007, 0x0009, 0x000d, 0x0011,
  0x0019, 0x0021, 0x0031, 0x0041, 0x0061, 0x0081, 0x00c1, 0x0101, 0x0181,
  0x0201, 0x0301, 0x0401, 0x0601, 0x0801, 0x0c01, 0x1001, 0x1801, 0x2001,
  0x3001, 0x4001, 0x6001
]);

/**
 * huffman dist extra-bits table.
 * @const
 * @type {!(Array.<number>|Uint8Array)}
 */
Zlib.RawInflate.DistExtraTable = (function(table) {
  return USE_TYPEDARRAY ? new Uint8Array(table) : table;
})([
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13
]);

/**
 * fixed huffman length code table
 * @const
 * @type {!Array}
 */
Zlib.RawInflate.FixedLiteralLengthTable = (function(table) {
  return table;
})((function() {
  var lengths = new (USE_TYPEDARRAY ? Uint8Array : Array)(288);
  var i, il;

  for (i = 0, il = lengths.length; i < il; ++i) {
    lengths[i] =
      (i <= 143) ? 8 :
      (i <= 255) ? 9 :
      (i <= 279) ? 7 :
      8;
  }

  return Zlib.Huffman.buildHuffmanTable(lengths);
})());

/**
 * fixed huffman distance code table
 * @const
 * @type {!Array}
 */
Zlib.RawInflate.FixedDistanceTable = (function(table) {
  return table;
})((function() {
  var lengths = new (USE_TYPEDARRAY ? Uint8Array : Array)(30);
  var i, il;

  for (i = 0, il = lengths.length; i < il; ++i) {
    lengths[i] = 5;
  }

  return Zlib.Huffman.buildHuffmanTable(lengths);
})());

/**
 * parse deflated block.
 */
Zlib.RawInflate.prototype.parseBlock = function() {
  /** @type {number} header */
  var hdr = this.readBits(3);

  // BFINAL
  if (hdr & 0x1) {
    this.bfinal = true;
  }

  // BTYPE
  hdr >>>= 1;
  switch (hdr) {
    // uncompressed
    case 0:
      this.parseUncompressedBlock();
      break;
    // fixed huffman
    case 1:
      this.parseFixedHuffmanBlock();
      break;
    // dynamic huffman
    case 2:
      this.parseDynamicHuffmanBlock();
      break;
    // reserved or other
    default:
      throw new Error('unknown BTYPE: ' + hdr);
  }
};

/**
 * read inflate bits
 * @param {number} length bits length.
 * @return {number} read bits.
 */
Zlib.RawInflate.prototype.readBits = function(length) {
  var bitsbuf = this.bitsbuf;
  var bitsbuflen = this.bitsbuflen;
  var input = this.input;
  var ip = this.ip;

  /** @type {number} */
  var inputLength = input.length;
  /** @type {number} input and output byte. */
  var octet;

  // input byte
  if (ip + ((length - bitsbuflen + 7) >> 3) >= inputLength) {
    throw new Error('input buffer is broken');
  }

  // not enough buffer
  while (bitsbuflen < length) {
    bitsbuf |= input[ip++] << bitsbuflen;
    bitsbuflen += 8;
  }

  // output byte
  octet = bitsbuf & /* MASK */ ((1 << length) - 1);
  bitsbuf >>>= length;
  bitsbuflen -= length;

  this.bitsbuf = bitsbuf;
  this.bitsbuflen = bitsbuflen;
  this.ip = ip;

  return octet;
};

/**
 * read huffman code using table
 * @param {!(Array.<number>|Uint8Array|Uint16Array)} table huffman code table.
 * @return {number} huffman code.
 */
Zlib.RawInflate.prototype.readCodeByTable = function(table) {
  var bitsbuf = this.bitsbuf;
  var bitsbuflen = this.bitsbuflen;
  var input = this.input;
  var ip = this.ip;

  /** @type {number} */
  var inputLength = input.length;
  /** @type {!(Array.<number>|Uint8Array)} huffman code table */
  var codeTable = table[0];
  /** @type {number} */
  var maxCodeLength = table[1];
  /** @type {number} code length & code (16bit, 16bit) */
  var codeWithLength;
  /** @type {number} code bits length */
  var codeLength;

  // not enough buffer
  while (bitsbuflen < maxCodeLength) {
    if (ip >= inputLength) {
      break;
    }
    bitsbuf |= input[ip++] << bitsbuflen;
    bitsbuflen += 8;
  }

  // read max length
  codeWithLength = codeTable[bitsbuf & ((1 << maxCodeLength) - 1)];
  codeLength = codeWithLength >>> 16;

  if (codeLength > bitsbuflen) {
    throw new Error('invalid code length: ' + codeLength);
  }

  this.bitsbuf = bitsbuf >> codeLength;
  this.bitsbuflen = bitsbuflen - codeLength;
  this.ip = ip;

  return codeWithLength & 0xffff;
};

/**
 * parse uncompressed block.
 */
Zlib.RawInflate.prototype.parseUncompressedBlock = function() {
  var input = this.input;
  var ip = this.ip;
  var output = this.output;
  var op = this.op;

  /** @type {number} */
  var inputLength = input.length;
  /** @type {number} block length */
  var len;
  /** @type {number} number for check block length */
  var nlen;
  /** @type {number} output buffer length */
  var olength = output.length;
  /** @type {number} copy counter */
  var preCopy;

  // skip buffered header bits
  this.bitsbuf = 0;
  this.bitsbuflen = 0;

  // len
  if (ip + 1 >= inputLength) {
    throw new Error('invalid uncompressed block header: LEN');
  }
  len = input[ip++] | (input[ip++] << 8);

  // nlen
  if (ip + 1 >= inputLength) {
    throw new Error('invalid uncompressed block header: NLEN');
  }
  nlen = input[ip++] | (input[ip++] << 8);

  // check len & nlen
  if (len === ~nlen) {
    throw new Error('invalid uncompressed block header: length verify');
  }

  // check size
  if (ip + len > input.length) { throw new Error('input buffer is broken'); }

  // expand buffer
  switch (this.bufferType) {
    case Zlib.RawInflate.BufferType.BLOCK:
      // pre copy
      while (op + len > output.length) {
        preCopy = olength - op;
        len -= preCopy;
        if (USE_TYPEDARRAY) {
          output.set(input.subarray(ip, ip + preCopy), op);
          op += preCopy;
          ip += preCopy;
        } else {
          while (preCopy--) {
            output[op++] = input[ip++];
          }
        }
        this.op = op;
        output = this.expandBufferBlock();
        op = this.op;
      }
      break;
    case Zlib.RawInflate.BufferType.ADAPTIVE:
      while (op + len > output.length) {
        output = this.expandBufferAdaptive({fixRatio: 2});
      }
      break;
    default:
      throw new Error('invalid inflate mode');
  }

  // copy
  if (USE_TYPEDARRAY) {
    output.set(input.subarray(ip, ip + len), op);
    op += len;
    ip += len;
  } else {
    while (len--) {
      output[op++] = input[ip++];
    }
  }

  this.ip = ip;
  this.op = op;
  this.output = output;
};

/**
 * parse fixed huffman block.
 */
Zlib.RawInflate.prototype.parseFixedHuffmanBlock = function() {
  switch (this.bufferType) {
    case Zlib.RawInflate.BufferType.ADAPTIVE:
      this.decodeHuffmanAdaptive(
        Zlib.RawInflate.FixedLiteralLengthTable,
        Zlib.RawInflate.FixedDistanceTable
      );
      break;
    case Zlib.RawInflate.BufferType.BLOCK:
      this.decodeHuffmanBlock(
        Zlib.RawInflate.FixedLiteralLengthTable,
        Zlib.RawInflate.FixedDistanceTable
      );
      break;
    default:
      throw new Error('invalid inflate mode');
  }
};

/**
 * parse dynamic huffman block.
 */
Zlib.RawInflate.prototype.parseDynamicHuffmanBlock = function() {
  /** @type {number} number of literal and length codes. */
  var hlit = this.readBits(5) + 257;
  /** @type {number} number of distance codes. */
  var hdist = this.readBits(5) + 1;
  /** @type {number} number of code lengths. */
  var hclen = this.readBits(4) + 4;
  /** @type {!(Uint8Array|Array.<number>)} code lengths. */
  var codeLengths =
    new (USE_TYPEDARRAY ? Uint8Array : Array)(Zlib.RawInflate.Order.length);
  /** @type {!Array} code lengths table. */
  var codeLengthsTable;
  /** @type {!(Uint8Array|Array.<number>)} literal and length code table. */
  var litlenTable;
  /** @type {!(Uint8Array|Array.<number>)} distance code table. */
  var distTable;
  /** @type {!(Uint8Array|Array.<number>)} code length table. */
  var lengthTable;
  /** @type {number} */
  var code;
  /** @type {number} */
  var prev;
  /** @type {number} */
  var repeat;
  /** @type {number} loop counter. */
  var i;
  /** @type {number} loop limit. */
  var il;

  // decode code lengths
  for (i = 0; i < hclen; ++i) {
    codeLengths[Zlib.RawInflate.Order[i]] = this.readBits(3);
  }
  if (!USE_TYPEDARRAY) {
    for (i = hclen, hclen = codeLengths.length; i < hclen; ++i) {
      codeLengths[Zlib.RawInflate.Order[i]] = 0;
    }
  }

  // decode length table
  codeLengthsTable = buildHuffmanTable(codeLengths);
  lengthTable = new (USE_TYPEDARRAY ? Uint8Array : Array)(hlit + hdist);
  for (i = 0, il = hlit + hdist; i < il;) {
    code = this.readCodeByTable(codeLengthsTable);
    switch (code) {
      case 16:
        repeat = 3 + this.readBits(2);
        while (repeat--) { lengthTable[i++] = prev; }
        break;
      case 17:
        repeat = 3 + this.readBits(3);
        while (repeat--) { lengthTable[i++] = 0; }
        prev = 0;
        break;
      case 18:
        repeat = 11 + this.readBits(7);
        while (repeat--) { lengthTable[i++] = 0; }
        prev = 0;
        break;
      default:
        lengthTable[i++] = code;
        prev = code;
        break;
    }
  }

  litlenTable = USE_TYPEDARRAY
    ? buildHuffmanTable(lengthTable.subarray(0, hlit))
    : buildHuffmanTable(lengthTable.slice(0, hlit));
  distTable = USE_TYPEDARRAY
    ? buildHuffmanTable(lengthTable.subarray(hlit))
    : buildHuffmanTable(lengthTable.slice(hlit));

  switch (this.bufferType) {
    case Zlib.RawInflate.BufferType.ADAPTIVE:
      this.decodeHuffmanAdaptive(litlenTable, distTable);
      break;
    case Zlib.RawInflate.BufferType.BLOCK:
      this.decodeHuffmanBlock(litlenTable, distTable);
      break;
    default:
      throw new Error('invalid inflate mode');
  }
};

/**
 * decode huffman code
 * @param {!(Array.<number>|Uint16Array)} litlen literal and length code table.
 * @param {!(Array.<number>|Uint8Array)} dist distination code table.
 */
Zlib.RawInflate.prototype.decodeHuffmanBlock = function(litlen, dist) {
  var output = this.output;
  var op = this.op;

  this.currentLitlenTable = litlen;

  /** @type {number} output position limit. */
  var olength = output.length - Zlib.RawInflate.MaxCopyLength;
  /** @type {number} huffman code. */
  var code;
  /** @type {number} table index. */
  var ti;
  /** @type {number} huffman code distination. */
  var codeDist;
  /** @type {number} huffman code length. */
  var codeLength;

  var lengthCodeTable = Zlib.RawInflate.LengthCodeTable;
  var lengthExtraTable = Zlib.RawInflate.LengthExtraTable;
  var distCodeTable = Zlib.RawInflate.DistCodeTable;
  var distExtraTable = Zlib.RawInflate.DistExtraTable;

  while ((code = this.readCodeByTable(litlen)) !== 256) {
    // literal
    if (code < 256) {
      if (op >= olength) {
        this.op = op;
        output = this.expandBufferBlock();
        op = this.op;
      }
      output[op++] = code;

      continue;
    }

    // length code
    ti = code - 257;
    codeLength = lengthCodeTable[ti];
    if (lengthExtraTable[ti] > 0) {
      codeLength += this.readBits(lengthExtraTable[ti]);
    }

    // dist code
    code = this.readCodeByTable(dist);
    codeDist = distCodeTable[code];
    if (distExtraTable[code] > 0) {
      codeDist += this.readBits(distExtraTable[code]);
    }

    // lz77 decode
    if (op >= olength) {
      this.op = op;
      output = this.expandBufferBlock();
      op = this.op;
    }
    while (codeLength--) {
      output[op] = output[(op++) - codeDist];
    }
  }

  while (this.bitsbuflen >= 8) {
    this.bitsbuflen -= 8;
    this.ip--;
  }
  this.op = op;
};

/**
 * decode huffman code (adaptive)
 * @param {!(Array.<number>|Uint16Array)} litlen literal and length code table.
 * @param {!(Array.<number>|Uint8Array)} dist distination code table.
 */
Zlib.RawInflate.prototype.decodeHuffmanAdaptive = function(litlen, dist) {
  var output = this.output;
  var op = this.op;

  this.currentLitlenTable = litlen;

  /** @type {number} output position limit. */
  var olength = output.length;
  /** @type {number} huffman code. */
  var code;
  /** @type {number} table index. */
  var ti;
  /** @type {number} huffman code distination. */
  var codeDist;
  /** @type {number} huffman code length. */
  var codeLength;

  var lengthCodeTable = Zlib.RawInflate.LengthCodeTable;
  var lengthExtraTable = Zlib.RawInflate.LengthExtraTable;
  var distCodeTable = Zlib.RawInflate.DistCodeTable;
  var distExtraTable = Zlib.RawInflate.DistExtraTable;

  while ((code = this.readCodeByTable(litlen)) !== 256) {
    // literal
    if (code < 256) {
      if (op >= olength) {
        output = this.expandBufferAdaptive();
        olength = output.length;
      }
      output[op++] = code;

      continue;
    }

    // length code
    ti = code - 257;
    codeLength = lengthCodeTable[ti];
    if (lengthExtraTable[ti] > 0) {
      codeLength += this.readBits(lengthExtraTable[ti]);
    }

    // dist code
    code = this.readCodeByTable(dist);
    codeDist = distCodeTable[code];
    if (distExtraTable[code] > 0) {
      codeDist += this.readBits(distExtraTable[code]);
    }

    // lz77 decode
    if (op + codeLength > olength) {
      output = this.expandBufferAdaptive();
      olength = output.length;
    }
    while (codeLength--) {
      output[op] = output[(op++) - codeDist];
    }
  }

  while (this.bitsbuflen >= 8) {
    this.bitsbuflen -= 8;
    this.ip--;
  }
  this.op = op;
};

/**
 * expand output buffer.
 * @param {Object=} opt_param option parameters.
 * @return {!(Array.<number>|Uint8Array)} output buffer.
 */
Zlib.RawInflate.prototype.expandBufferBlock = function(opt_param) {
  /** @type {!(Array.<number>|Uint8Array)} store buffer. */
  var buffer =
    new (USE_TYPEDARRAY ? Uint8Array : Array)(
        this.op - Zlib.RawInflate.MaxBackwardLength
    );
  /** @type {number} backward base point */
  var backward = this.op - Zlib.RawInflate.MaxBackwardLength;
  /** @type {number} copy index. */
  var i;
  /** @type {number} copy limit */
  var il;

  var output = this.output;

  // copy to output buffer
  if (USE_TYPEDARRAY) {
    buffer.set(output.subarray(Zlib.RawInflate.MaxBackwardLength, buffer.length));
  } else {
    for (i = 0, il = buffer.length; i < il; ++i) {
      buffer[i] = output[i + Zlib.RawInflate.MaxBackwardLength];
    }
  }

  this.blocks.push(buffer);
  this.totalpos += buffer.length;

  // copy to backward buffer
  if (USE_TYPEDARRAY) {
    output.set(
      output.subarray(backward, backward + Zlib.RawInflate.MaxBackwardLength)
    );
  } else {
    for (i = 0; i < Zlib.RawInflate.MaxBackwardLength; ++i) {
      output[i] = output[backward + i];
    }
  }

  this.op = Zlib.RawInflate.MaxBackwardLength;

  return output;
};

/**
 * expand output buffer. (adaptive)
 * @param {Object=} opt_param option parameters.
 * @return {!(Array.<number>|Uint8Array)} output buffer pointer.
 */
Zlib.RawInflate.prototype.expandBufferAdaptive = function(opt_param) {
  /** @type {!(Array.<number>|Uint8Array)} store buffer. */
  var buffer;
  /** @type {number} expantion ratio. */
  var ratio = (this.input.length / this.ip + 1) | 0;
  /** @type {number} maximum number of huffman code. */
  var maxHuffCode;
  /** @type {number} new output buffer size. */
  var newSize;
  /** @type {number} max inflate size. */
  var maxInflateSize;

  var input = this.input;
  var output = this.output;

  if (opt_param) {
    if (typeof opt_param.fixRatio === 'number') {
      ratio = opt_param.fixRatio;
    }
    if (typeof opt_param.addRatio === 'number') {
      ratio += opt_param.addRatio;
    }
  }

  // calculate new buffer size
  if (ratio < 2) {
    maxHuffCode =
      (input.length - this.ip) / this.currentLitlenTable[2];
    maxInflateSize = (maxHuffCode / 2 * 258) | 0;
    newSize = maxInflateSize < output.length ?
      output.length + maxInflateSize :
      output.length << 1;
  } else {
    newSize = output.length * ratio;
  }

  // buffer expantion
  if (USE_TYPEDARRAY) {
    buffer = new Uint8Array(newSize);
    buffer.set(output);
  } else {
    buffer = output;
  }

  this.output = buffer;

  return this.output;
};

/**
 * concat output buffer.
 * @return {!(Array.<number>|Uint8Array)} output buffer.
 */
Zlib.RawInflate.prototype.concatBufferBlock = function() {
  /** @type {number} buffer pointer. */
  var pos = 0;
  /** @type {number} buffer pointer. */
  var limit = this.totalpos + (this.op - Zlib.RawInflate.MaxBackwardLength);
  /** @type {!(Array.<number>|Uint8Array)} output block array. */
  var output = this.output;
  /** @type {!Array} blocks array. */
  var blocks = this.blocks;
  /** @type {!(Array.<number>|Uint8Array)} output block array. */
  var block;
  /** @type {!(Array.<number>|Uint8Array)} output buffer. */
  var buffer = new (USE_TYPEDARRAY ? Uint8Array : Array)(limit);
  /** @type {number} loop counter. */
  var i;
  /** @type {number} loop limiter. */
  var il;
  /** @type {number} loop counter. */
  var j;
  /** @type {number} loop limiter. */
  var jl;

  // single buffer
  if (blocks.length === 0) {
    return USE_TYPEDARRAY ?
      this.output.subarray(Zlib.RawInflate.MaxBackwardLength, this.op) :
      this.output.slice(Zlib.RawInflate.MaxBackwardLength, this.op);
  }

  // copy to buffer
  for (i = 0, il = blocks.length; i < il; ++i) {
    block = blocks[i];
    for (j = 0, jl = block.length; j < jl; ++j) {
      buffer[pos++] = block[j];
    }
  }

  // current buffer
  for (i = Zlib.RawInflate.MaxBackwardLength, il = this.op; i < il; ++i) {
    buffer[pos++] = output[i];
  }

  this.blocks = [];
  this.buffer = buffer;

  return this.buffer;
};

/**
 * concat output buffer. (dynamic)
 * @return {!(Array.<number>|Uint8Array)} output buffer.
 */
Zlib.RawInflate.prototype.concatBufferDynamic = function() {
  /** @type {Array.<number>|Uint8Array} output buffer. */
  var buffer;
  var op = this.op;

  if (USE_TYPEDARRAY) {
    if (this.resize) {
      buffer = new Uint8Array(op);
      buffer.set(this.output.subarray(0, op));
    } else {
      buffer = this.output.subarray(0, op);
    }
  } else {
    if (this.output.length > op) {
      this.output.length = op;
    }
    buffer = this.output;
  }

  this.buffer = buffer;

  return this.buffer;
};


/**
 * @constructor
 * @param {!(Uint8Array|Array)} input deflated buffer.
 * @param {Object=} opt_params option parameters.
 *
 * opt_params は以下のプロパティを指定する事ができます。
 *   - index: input buffer の deflate コンテナの開始位置.
 *   - blockSize: バッファのブロックサイズ.
 *   - verify: 伸張が終わった後 adler-32 checksum の検証を行うか.
 *   - bufferType: Zlib.Inflate.BufferType の値によってバッファの管理方法を指定する.
 *       Zlib.Inflate.BufferType は Zlib.RawInflate.BufferType のエイリアス.
 */
Zlib.Inflate = function(input, opt_params) {
  /** @type {number} */
  var bufferSize;
  /** @type {Zlib.Inflate.BufferType} */
  var bufferType;
  /** @type {number} */
  var cmf;
  /** @type {number} */
  var flg;

  /** @type {!(Uint8Array|Array)} */
  this.input = input;
  /** @type {number} */
  this.ip = 0;
  /** @type {Zlib.RawInflate} */
  this.rawinflate;
  /** @type {(boolean|undefined)} verify flag. */
  this.verify;

  // option parameters
  if (opt_params || !(opt_params = {})) {
    if (opt_params['index']) {
      this.ip = opt_params['index'];
    }
    if (opt_params['verify']) {
      this.verify = opt_params['verify'];
    }
  }

  // Compression Method and Flags
  cmf = input[this.ip++];
  flg = input[this.ip++];

  // compression method
  switch (cmf & 0x0f) {
    case Zlib.CompressionMethod.DEFLATE:
      this.method = Zlib.CompressionMethod.DEFLATE;
      break;
    default:
      throw new Error('unsupported compression method');
  }

  // fcheck
  if (((cmf << 8) + flg) % 31 !== 0) {
    throw new Error('invalid fcheck flag:' + ((cmf << 8) + flg) % 31);
  }

  // fdict (not supported)
  if (flg & 0x20) {
    throw new Error('fdict flag is not supported');
  }

  // RawInflate
  this.rawinflate = new Zlib.RawInflate(input, {
    'index': this.ip,
    'bufferSize': opt_params['bufferSize'],
    'bufferType': opt_params['bufferType'],
    'resize': opt_params['resize']
  });
}

/**
 * @enum {number}
 */
Zlib.Inflate.BufferType = Zlib.RawInflate.BufferType;

/**
 * decompress.
 * @return {!(Uint8Array|Array)} inflated buffer.
 */
Zlib.Inflate.prototype.decompress = function() {
  /** @type {!(Array|Uint8Array)} input buffer. */
  var input = this.input;
  /** @type {!(Uint8Array|Array)} inflated buffer. */
  var buffer;
  /** @type {number} adler-32 checksum */
  var adler32;

  buffer = this.rawinflate.decompress();
  this.ip = this.rawinflate.ip;

  // verify adler-32
  if (this.verify) {
    adler32 = (
      input[this.ip++] << 24 | input[this.ip++] << 16 |
      input[this.ip++] << 8 | input[this.ip++]
    ) >>> 0;

    if (adler32 !== Zlib.Adler32(buffer)) {
      throw new Error('invalid adler-32 checksum');
    }
  }

  return buffer;
};
