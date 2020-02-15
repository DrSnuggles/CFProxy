/*
Advanced proxy by DrSnuggles using a cloudflare worker
Vectrexer had the nice idea to also load ZIP/RAR/7Z content
I was first thinking of doing that client side
but since Vectrexer requested this feature for URLs i will do here
and deliver depacked content to vecx

Since i do not know if we have a valid rom/bios/png/...
i will try to decrunch first, sorry cloudflare...

Test:
Oregon Trail: https://docs.google.com/uc?export=download&id=1zBvCN6Ap9723LGDcXNonXFppOsaW2Mu4
MineStorm.ZIP: https://docs.google.com/uc?export=download&id=1WcrVSDBkcIsfVZFnMRdJFxXMLdNTzW1r
Protector/Y*A*S*I: http://www.herbs64.plus.com/files/py050712.zip
*/

//
// Vars
//
var debug = true
var maxSize = 256 * 1024 // 256kB
var JSZip = require('jszip');

//
// Listener
//
addEventListener('fetch', event => {
  if (debug) console.clear()
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
      if (debug) console.log(res)
      //return new Response(res)
      return decrunchTry(res, src, dst)
      .then(res => {
        if (debug) console.log("after dec: ", res)
        if (res) {
          return res
        } else {
          return nope(src, dst)
        }

      })
    })
    .catch(e => {
      console.error("recFetch catch:", e)
    })

  } else {
    // not allowed
    return nope(src, dst)
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
        console.error("found unhandled status: ", res)
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
    if (debug) console.log("nope")
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
  var zipped = false

  // use reader
  var reader = res.body.getReader()
  var chunk = await reader.read() // we are not really sure if it's compressed or not

  // quick req if zipped or not. first two chars = PK
  if (chunk.value[0] === 80 && chunk.value[1] === 75) {
    if (debug) console.log("PK header found in:", chunk)
    zipped = true
  }

  //
  // Pump all chunks because we already started reading
  //
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
  if (debug) console.log("read complete", arr)
  var buf = new Uint8Array(arr).buffer;

  // identify known formats
  //if (debug) console.log(arr)
  if (!zipped) {
    var td = new TextDecoder()
    var stream = td.decode(buf) // now without await, we waited long enough....
    var meta = {"status": res.status, "statusText": res.statusText }
    var res = new Response(stream, meta)
    return res
  }

  // depack / inflate / decrunch / unzip
  if (debug) console.log("OK we send it to unzip")
  return JSZip.loadAsync(buf)
  .then(zip => {
    return decFile(zip)
    .then(stream => {
      console.log("after decFile stream:", stream)
      var meta = {"status": 200, "statusText": "OK" }
      return new Response(stream, meta)
    })
  })
  .then(ret => {
    // this also handled external
    console.log("after loadAsync:", ret)
    return ret
  })
}

async function decFile(zip) {
  if (debug) console.log("decFile", zip)
  //object.keys(zip.files).forEach(function(filename){
  //for (var i in zip.files) {
  var i = Object.keys(zip.files)[0] // firstFile
  if (debug) console.log("Decrunch single file", zip.files[i]);


  var data = await zip.files[i].async("arraybuffer")
  if (debug) console.log("async")

  // Create an identity TransformStream (a.k.a. a pipe).
  // The readable side will become our new response body.
  let { readable, writable } = new TransformStream()

  // Start pumping the body. NOTE: No await!
  streamBody(zip.files[i].async("arraybuffer"), writable)

  // ... and deliver our Response while that's running.
  //return new Response(readable, response)
  return readable

  // now using ArrayBuffer as return
  //var data = await zip.files[i].async("arraybuffer")
  //console.log(data)
  //return data
  /*
  .then(data => {
    if (debug) console.log("Decrunched single file");
    if (debug) console.log(data)
    var td = new TextDecoder()
    var stream = td.decode(data) // now without await, we waited long enough....
    var meta = {"status": 200, "statusText": "OK" }
    var res = new Response(stream, meta)
    //
    // Exit
    //
    if (debug) console.log(stream)
    return res
  })
  .catch(e => {
    console.error("we catched a zip error.. so this file wasn't zipped", e)
    var td = new TextDecoder()
    var stream = td.decode(buf) // now without await, we waited long enough....
    var meta = {"status": 200, "statusText": "OK" }
    var res = new Response(stream, meta)
    //
    // Exit
    //
    if (debug) console.log(stream)
    return res
  })
  */
}

// https://developers.cloudflare.com/workers/archive/recipes/streaming-responses/
async function streamBody(readable, writable) {
  // This function will continue executing after `fetchAndStream()`
  // returns its response.
  if (debug) console.log("streamBody:", readable, writable)
  return readable.pipeTo(writable)
}
