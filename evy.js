/* jshint asi:true, boss:true, expr:true, eqnull:true, -W058 */

//     evy.js
//
//     Version 0.2.3
//     Ricardo Tomasi <ricardobeat@gmail.com>
//     License: MIT (http://ricardo.mit-license.org/)
//     http://github.com/ricardobeat/evy

// Evy.js is a modern EventEmitter implementation that combines
// the best from node's EventEmitter, EE2 and Backbone Events.

;(function(){

    // First we declare some utility variables. The `uid` is used to assign a unique id
    // for emitters, if a name has not been provided.

    var slice = Array.prototype.slice
    var _hasImmediate = (typeof setImmediate === 'function')
    var uid = 0

    // Function binding method. Doing this is faster and uses less memory than `Function.prototype.bind`.

    function _bind (fn, context, args) {
        return function () {
            return fn.apply(context, args)
        }
    }


    // EventEmitter
    // ------------------------------------------------------------------------

    // This is the EventEmitter constructor, accepting a single *options* object
    // for configuration. The options are:
    //
    // - **name**   : _String_  [optional name]
    // - **strict** : _Boolean_ [enable strict mode]
    // - **async**  : _Boolean_ [use emitNext by default]
    // - **debug**  : _Boolean_ [enable debug mode]
    //

    function EventEmitter (options) {
        options || (options = {})

        var _events = this._events = {
            events    : {},                     // listeners attached to this emitter
            listening : [],                     // remote listeners (listenTo)
            context   : options.context,        // default emitter context
            count     : 0,
            name      : options.name || ++uid
        }

        if (options.debug) {
            _events.debug = true
            _events.last  = { time: 0, eventCount : 0 }
        }

        if (options.strict) {
            _events.strict = true
            _events.strictKeys = options.events
            if (!options.events) {
                throw new Error('No events defined for emitter ' + _events.name)
            }
        }

        if (options.async) {
            this.emitSync = this.emit
            this.emit     = this.emitNext
            _events.async = true
        }
    }

    // When given the option { strict: true }, an emitter will validate the
    // event names before adding handlers or emitting an event. This method is shared
    // by all methods that manipulate events.

    function validateEvent (emitter, method, name) {
        var ee = emitter._events
        if (ee.strict && ee.strictKeys.hasOwnProperty(name)) return
        var err = new Error(
            method + "(): event '" + name + "' has not been registered for emitter " + ee.name
        )
        err.emitter = emitter
        throw err
    }

    // In this case all events must be declared on creation. For example:
    //
    //     new EventEmitter({
    //         strict: true,
    //         events: {
    //             'eventName' : 'description',
    //             'open'      : 'Open stuff',
    //             'close'     : 'Close stuff'
    //         }
    //     })
    //

    // .addListener
    // ------------------------------------------------------------------------
    // Adds a handler to the events list.

    EventEmitter.prototype.addListener = function (name, fn, context) {
        var ee = this._events
        if (name == null) throw new Error('addListener(name, fn, context): name cant be ' + name)
        if (ee.strict) validateEvent(this, 'addListener', name)
        var handlers = ee.events[name] || (ee.events[name] = [])
        handlers.push(context ? { fn: fn, context: context } : fn)
        return this
    }

    // .once
    // ------------------------------------------------------------------------
    // Adds a handler that will only get called once, removing itself after the first call.

    EventEmitter.prototype.once = function (name, fn) {
        var ee = this._events
        if (ee.strict) validateEvent(this, 'once', name)
        var self  = this
        var fired = false
        function onceFn () {
            if (!fired) {
                fired = true
                fn.apply(this, arguments)
                self.removeListener(name, onceFn)
            }
        }
        return this.addListener(name, onceFn)
    }

    // .removeListener
    // ------------------------------------------------------------------------
    // Removes an event handler from the events list.

    EventEmitter.prototype.removeListener = function (name, fn) {
        var ee = this._events
        if (ee.strict) validateEvent(this, 'removeListener', name)
        var self     = this
        var handlers = this._events.events[name]
        // Remove all events, filtering by function if provided
        if (name === '*') {
            if (!fn) {
                ee.events = {}
            } else {
                for (var _name in ee.events) {
                    if (ee.events.hasOwnProperty(_name)) {
                        self.removeListener(_name, fn)
                    }
                }
            }
        // Otherwise find handlers that match the given event name and function signature
        } else if (fn && handlers) {
            var _handlers = slice.call(handlers, 0)
            for (var i = 0; i < _handlers.length; i++) {
                var ee = ee
                if (_handlers[i] && (_handlers[i] === fn || _handlers[i].fn === fn)) {
                    handlers.splice(i, 1)
                }
            }
            if (handlers.length === 0) {
                delete ee.events[name]
            }
        // If only a name was given, remove all handlers for this event
        } else {
            delete ee.events[name]
        }

        return this
    }

    // .emit
    // ------------------------------------------------------------------------
    // The `emit` method calls all handlers that match the given event type.

    EventEmitter.prototype.emit = function (name) {
        var ee = this._events
        if (name == null) throw new Error('emit(name): name cant be ' + name)
        if (ee.strict) validateEvent(this, 'emit', name)
        if (ee.debug) this.tick()
        var handlers = ee.events[name]
        if (!handlers) return this
        handlers = slice.call(handlers, 0)
        for (var i = 0; i < handlers.length; i++) {
            var handler = handlers[i]
            var context = handler.context || ee._context || this
            var fn      = handler.fn || handler
            var length  = arguments.length
            switch (length) { // optimize most common calls (inspired by Backbone)
                case 1: fn.call(context); break
                case 2: fn.call(context, arguments[1]); break
                case 3: fn.call(context, arguments[1], arguments[2]); break
                default: // args optimization borrowed from node EventEmitter (lib/events.js)
                    var args = new Array(length - 1)
                    for (i = 1; i < length; i++) args[i - 1] = arguments[i]
                    fn.apply(context, args)
            }
        }
        return this
    }

    // .emitNext
    // ------------------------------------------------------------------------
    // Schedules an event to the next tick, using whatever method is
    // available in the environment. Useful when an emitter starts firing events
    // immediately after creation, before any listeners are added.
    EventEmitter.prototype.emitNext = function (name) {
        var ee = this._events
        if (ee.strict) validateEvent(this, 'emitNext', name)
        var self = this, args = arguments
        var run = _bind(EventEmitter.prototype.emit, self, args)
        return _hasImmediate ? setImmediate(run) : setTimeout(run, 0)
    }

    // The `tick` method is here for debugging purposes. It keeps count of emitted events over time
    // and calculates a running average rate for the past 2 seconds. Mostly useful for finding
    // accidental loops and optimizing code.
    // *TODO: trigger console warning if rate is too high*

    EventEmitter.prototype.tick = function () {
        var ee   = this._events
        var now  = +new Date
        var last = ee.last
        ee.count++
        if (now - last.time > 5000) {
            ee.rate = Math.floor((ee.count - last.count) / (now - last.time) / 1000)
            ee.last = { time: now, count: ee.count }
        }
    }

    // .proxy
    // ------------------------------------------------------------------------
    // The `proxy` method returns a function that emits $name event on the emitter that
    // created it. It also accepts a `transform` function that will be called on the event
    // data before being forwarded. Use (with caution) to create event chains / pipes.

    EventEmitter.prototype.proxy = function (name, transform) {
        var self = this
        return function () {
            var args = slice.call(arguments, 0)
            if (typeof transform === 'function') {
                args = transform.apply(null, args)
            }
            args.unshift(name)
            self.emit.apply(self, args)
        }
    }

    // EventEmitter.extend
    // ------------------------------------------------------------------------
    // Copies all properties and methods to target object.
    // For use when creating a new emitter instance, or prototypal inheritance, is undesired.

    EventEmitter.extend = function (target, options) {
        EventEmitter.call(target, options)
        var proto = EventEmitter.prototype
        for (var key in proto) {
            if (!proto.hasOwnProperty(key)) continue
            target[key] = proto[key]
        }
        return target
    }

    // EventEmitter.create
    // ------------------------------------------------------------------------
    // Creates a new emitter without the `new` keyword. Makes some people very happy.
    EventEmitter.create = function (options) {
        return new EventEmitter(options)
    }

    // Create aliases for the most common method names, makes it somewhat compatible with
    // other emitter implementations.
    var aliases = {
        on      : 'addListener',
        off     : 'removeListener',
        trigger : 'emit',
        one     : 'once'
    }

    for (var key in aliases) {
        if (!aliases.hasOwnProperty(key)) continue
        EventEmitter.prototype[key] = EventEmitter.prototype[aliases[key]]
    }

    // Finally, export the constructor as a commonJS / global / AMD module.

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventEmitter
    } else if (typeof define === 'function') {
        define('Evy', function () { return EventEmitter })
    } else {
        this.Evy = EventEmitter
    }

}).call(this);
