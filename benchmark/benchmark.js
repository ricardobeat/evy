/* jshint sub: true */

var Table  = require('easy-table')
var queue  = require('queue-async')

var Evy           = require('../events')
var BackboneEE    = require('backbone').Events
var EventEmitter  = require('events').EventEmitter
var FastEmitter   = require('fastemitter')
var Event_Emitter = require('event-emitter')
var EventEmitter2 = require('eventemitter2').EventEmitter2
var EventEmitter3 = require('eventemitter3').EventEmitter

function printResults (results) {
    var t = new Table
    results.forEach(function (test) {
        for (var key in test) {
            t.cell(key, test[key])
        }
        t.newRow()
    });
    console.log(t.toString())
}

function testAll (testName, args, next) {
    var results = []
    var q = queue()

    var libs = [
        [ "Backbone.Events" , BackboneEE          ],
        [ "fastemitter"     , new FastEmitter()   ],
        [ "event-emitter"   , Event_Emitter({})   ],
        [ "node events"     , new EventEmitter()  ],
        [ "EventEmitter2"   , new EventEmitter2() ],
        [ "EventEmitter3"   , new EventEmitter3() ],
        [ "Evy"             , new Evy             ]
    ]

    if (typeof window !== 'undefined') {
        libs.unshift([ "jQuery", require('jquery')({}) ])
    }

    libs.forEach(function (lib) {
        q.defer(test, results, testName, lib[0], lib[1], args)
    })
    
    q.await(function(){
        printResults(results)
        next()
    })
}

function test (group, header, name, emitter, args, next) {
    var data     = {}
    var emitted  = 0
    var received = 0
    var duration = 2000
    var start    = Date.now()
    var heapUsed = process.memoryUsage().heapUsed

    data[header] = name

    // patch backbone
    if (!emitter.emit) emitter.emit = emitter.trigger

    var done = function (sync) {
        if (received != emitted) return

        var elapsed = ((Date.now() - (sync ? start : after)) / 1000)
        var rate    = (received / elapsed).toFixed(3)
        var mem     = process.memoryUsage()
        var bytes   = ((mem.heapUsed - heapUsed) / received).toFixed(2)

        data['received'] = received
        data['time'] = elapsed.toFixed(2) + 's'
        data['received/sec'] = rate
        data['memory'] = (bytes > 20 ? (bytes | 0) + ' bytes' : 'n/a')

        group.push(data)
        next()
    }

    emitter.on('test', function () {
        received++
        done()
    })

    while (Date.now() - start < duration) {
        switch (args) {
            case 0: emitter.emit('test'); break
            case 1: emitter.emit('test', 1); break
            case 2: emitter.emit('test', 1, 2); break
            case 3: emitter.emit('test', 1, 2, 3); break
            case 4: emitter.emit('test', 1, 2, 3, 4); break
            default: throw new Error("Argument length must be provided.")
        }
        emitted++
    }

    var after = Date.now()

    data['emitted'] = emitted
    data['events/sec (*1k)'] = Math.floor(emitted / duration) | 0
    data['immediate'] = received
    done(true)
}

console.log('Running benchmarks...\n')


queue()
    .defer(testAll, 'No arguments', 0)
    .defer(testAll, 'One argument', 1)
    .defer(testAll, 'Three arguments', 3)
    .defer(function(){
        var results = []
        test(results, 'async', "Evy.async", new Evy({ async: true }), 1, function () {
            printResults(results)
        })
    })
    .await(function(){
        console.log('Finished.')
    })