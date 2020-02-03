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
var pako = require('pako');

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
    var res = new pako.inflate(buf, {to:'string'})
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
