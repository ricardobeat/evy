/* jshint asi:true, boss:true, expr:true, eqnull:true, -W058 */

//     emmy.js
//
//     Version 0.1.0
//     Ricardo Tomasi <ricardobeat@gmail.com>
//     License: MIT (http://ricardo.mit-license.org/)
//     http://github.com/ricardobeat/emmy

// Emmy is a modern EventEmitter implementation that combines
// the best from node's EventEmitter, EE2 and Backbone. In
// default sync mode it should perform better than all of the above,
// while offering a compatible API and extra features like a debug mode.

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

        this._events    = {}               // listeners attached to this emitter
        this._listening = []               // remote listeners (listenTo)
        this.context    = options.context  // default emitter context
        this.eventCount = 0
        this.name       = options.name || ++uid

        if (options.debug) {
            this._debug = true
            this._last  = { time: 0, eventCount : 0 }
        }

        if (options.strict) {
            this._strict = true
            this._eventKeys = options.events
            if (!options.events) {
                throw new Error('No events defined for emitter ' + this.name)
            }
        }

        if (options.async) {
            this.emitSync = this.emit
            this.emit     = this.emitNext
            this._async   = true
        }
    }

    // When given the option { strict: true }, an emitter will validate the
    // event names before adding handlers or emitting an event. This method is shared
    // by all the methods that manipulate events.
    function validateEvent (emitter, method, name) {
        if (emitter._strict && emitter._eventKeys.hasOwnProperty(name)) return
        var err = new Error(
            method + "(): event '" + name + "' has not been registered for emitter " + emitter.name
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

    // #### .addListener
    // Adds a handler to the events list.
    EventEmitter.prototype.addListener = function (name, fn, context) {
        this._strict && validateEvent(this, 'addListener', name)
        var handlers = this._events[name] || (this._events[name] = [])
        handlers.push(context ? { fn: fn, context: context } : fn)
        for (var i = 0; i < handlers.length; i++) {
            if (handlers[i] == null) handlers.splice(i, 1)
        }
        return this
    }

    // #### .once
    // Adds a handler that will only get called once, by removing itself after the first call.
    EventEmitter.prototype.once = function (name, fn) {
        this._strict && validateEvent(this, 'once', name)
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

    // #### .removeListener
    // Removes an event handler from the events list.
    EventEmitter.prototype.removeListener = function (name, fn, context) {
        this._strict && validateEvent(this, 'removeListener', name)
        var self     = this
        var handlers = this._events[name]
        // Remove all events, filtering by function if provided
        if (name === '*') {
            if (!fn) {
                this._events = {}
            } else {
                for (var _name in this._events) {
                    if (this._events.hasOwnProperty(_name)) {
                        self.removeListener(_name, fn)
                    }
                }
            }
        // Otherwise find handlers that match the given event name and function signature
        } else if (fn && handlers) {
            for (var i = 0; i < handlers.length; i++) {
                if (handlers[i] && (handlers[i] === fn || handlers[i].fn === fn)) {
                    /* instead of calling .splice(i, 1) here, we'll
                    set this handler to null and defer the cleanup
                    to the next addListener call. */
                    handlers[i] = null
                }
            }
            if (handlers.length === 0) {
                delete this._events[name]
            }
        // If only a name was given, remove all handlers for this event
        } else {
            delete this._events[name]
        }
        return this
    }
    // #### .emit
    // The `emit` method calls all handlers that match the given event type.
    EventEmitter.prototype.emit = function (name) {
        this._strict && validateEvent(this, 'emit', name)
        var handlers = this._events[name]
        this._debug && this.tick()
        if (!handlers) return this
        for (var i = 0; i < handlers.length; i++) {
            var handler = handlers[i]
            if (!handler) continue
            var context = handler.context || this._context || this
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

    // #### .emitNext
    // Schedules an event to the next tick, using the methods
    // available in the environment. Useful when an emitter fires events
    // straight after creation, without giving listeners a chance to be setup.
    EventEmitter.prototype.emitNext = function (name) {
        this._strict && validateEvent(this, 'emitNext', name)
        var self = this, args = arguments
        var run = _bind(EventEmitter.prototype.emit, self, args)
        return _hasImmediate ? setImmediate(run) : setTimeout(run, 0)
    }

    // The `tick` method is here for debugging purposes. It keeps count of emitted events over time
    // and calculates a running average rate for the past 2 seconds. Mostly useful for finding 
    // accidental loops and optimizing code.
    // *TODO: trigger console warning if rate is too high*
    EventEmitter.prototype.tick = function () {
        var now  = +new Date
        var last = this._last
        this.eventCount++
        if (now - last.time > 5000) {
            this.rate = Math.floor((this.eventCount - last.eventCount) / (now - last.time) / 1000)
            this._last = { time: now, eventCount: this.eventCount }
        }
    }

    // #### .proxy
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

    // #### .listenTo
    // The `listenTo` method attaches listeners to another object,
    // while keeping track of them for easy clean-up. The gist of the implementation
    // is handled by the `RemoteListener` objects.
    EventEmitter.prototype.listenTo = function (target, name, fn, context) {
        var listener = new RemoteListener(target, name, fn, context)
        listener.attach()
        this._listening.push(listener)
    }

    // #### .listenToOne
    // `listenToOne` is the same as above but with "once" behaviour, removing itself
    // after the first call.
    EventEmitter.prototype.listenToOne = function (target, name, fn, context) {
        var fired = false
        var self  = this
        var onceFn = function () {
            if (fired) return
            fired = true
            fn.apply(this, arguments)
            self.stopListening(name, onceFn)
        }
        return this.listenTo(target, name, onceFn, context)
    }

    // #### .stopListening
    // Removes all remote listeners.
    EventEmitter.prototype.stopListening = function (target, name, fn) {
        for (var i = 0, listener; listener = this._listening[i]; i++) {
            if (listener.matches(target, name, fn)) {
                listener.detach()
            }
        }
    }

    // #### .destroy
    // A shortcut for easily removing all local *and* remote listeners.
    EventEmitter.prototype.destroy = function () {
        this.removeListener('*')
        this.stopListening()
    }

    // RemoteListener
    // ------------------------------------------------------------------------

    // Internal object used by the `listenTo()` family of methods. Keeps track of all listeners added to
    // another emitter, forwarding method calls and arguments.
    
    function RemoteListener (target, name, fn, context) {
        this.target  = target
        this.name    = name
        this.fn      = fn
        this.context = context
    }

    // Attaches handlers to target.
    RemoteListener.prototype.attach = function () {
        var target = this.target
        var method = target.addListener || target.on || target.bind
        method.call(target, this.name, this.fn, this.context)
        return this
    }

    // Detaches handlers from target.
    RemoteListener.prototype.detach = function () {
        var target = this.target
        var method = target.removeListener || target.off || target.unbind
        method.call(target, this.name, this.fn)
        return this
    }

    // Test if listener matches the given arguments, used by `stopListening`.
    RemoteListener.prototype.matches = function (target, name, fn) {
        return (
            (!target || target === this.target) &&
            (!name   || name === this.name) &&
            (!fn     || fn === this.fn)
        )
    }

    // ### Convenience methods

    // #### EventEmitter.extend
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

    // #### EventEmitter.create
    // Creates a new emitter without the `new` keyword. Makes some people very happy.
    EventEmitter.create = function (options) {
        return new EventEmitter(options)
    }

    // Create aliases for the most common method names, makes it somewhat compatible with
    // other emitter implementations.
    var aliases = {
        on            : 'addListener',
        off           : 'removeListener',
        trigger       : 'emit',
        one           : 'once',
        publish       : 'emit',
        subscribe     : 'addListener',
        unsubscribe   : 'removeListener'
    }

    for (var key in aliases) {
        if (!aliases.hasOwnProperty(key)) continue
        EventEmitter.prototype[key] = EventEmitter.prototype[aliases[key]]
    }

    // Finally, export the constructor as a commonJS / global / AMD module.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = EventEmitter
    } else if (typeof define !== 'undefined') {
        define('Emmy', function () { return EventEmitter })
    } else {
        this.Emmy = EventEmitter
    }

}).call(this);
