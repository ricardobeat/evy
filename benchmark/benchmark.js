/* jshint sub: true */

var Table        = require('easy-table')
var queue        = require('queue-async')
var Emmy         = require('../events')
var Backbone     = require('backbone')
var EventEmitter = require('events').EventEmitter
var Event_mitter = require('event-emitter')
var _            = require('backbone/node_modules/underscore')

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
    queue()
        .defer(test, results, testName, "Emmy", new Emmy, args)
        .defer(test, results, testName, "Backbone.Events", _.extend({}, Backbone.Events), args)
        .defer(test, results, testName, "node EventEmitter", new EventEmitter, args)
        .defer(test, results, testName, "event-emitter", Event_mitter({}), args)
        .await(function(){
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

        var elapsed = ((Date.now() - (sync ? start : after)) / 1000).toFixed(3)
        var rate    = (received / elapsed).toFixed(3)
        var mem     = process.memoryUsage()
        var bytes   = ((mem.heapUsed - heapUsed) / received).toFixed(2)

        data['received'] = received
        data['time'] = elapsed
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
    data['events/sec'] = (emitted / duration).toFixed(2)
    data['immediate'] = received
    done(true)
}

console.log('Running benchmarks...\n')


queue()
    .defer(testAll, 'No arguments', 0)
    .defer(testAll, 'One argument', 1)
    .defer(testAll, 'Four arguments', 4)
    .defer(function(){
        var results = []
        test(results, 'async', "Emmy.async", new Emmy({ async: true }), 4, function () {
            printResults(results)
        })
    })
    .await(function(){
        console.log('Finished.')
    })