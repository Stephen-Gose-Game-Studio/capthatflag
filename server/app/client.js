'use strict';

var _ = require('lodash')
    , utils = require('../../shared/utils')
    , shortid = require('shortid')
    , Node = require('../../shared/node')
    , EntityFactory = require('./entityFactory')
    , config = require('./config.json')
    , Client;

/**
 * Client class.
 * @class shared.Client
 * @extends shared.Node
 */
Client = utils.inherit(Node, {
    /**
     * @inheritdoc
     */
    key: 'client'
    /**
     * Identifier for this client.
     * @type {string}
     */
    , id: null
    /**
     * Socket interface for this client.
     * @type {Socket}
     */
    , socket: null
    /**
     * Room instance that this client is connected to.
     * @type {server.Room}
     */
    , room: null
    /**
     * Player entity associated with this client.
     * @type {server.Entity}
     */
    , player: null
    /**
     * Creates a new client.
     * @param {string} id client identifier
     * @param {Socket} socket socket interface
     * @param {server.Room} room instance
     * @constructor
     */
    , constructor: function(id, socket, room) {
        Node.apply(this);

        this.id = id;
        this.socket = socket;
        this.room = room;

        console.log('  client %s created for room %s', this.id, this.room.id);
    }
    /**
     * Initializes this client.
     */
    , init: function() {
        // create a socket for this room and join it
        this.socket.join(this.room.id);

        // let the client know to which room they have connected
        this.socket.emit('client.joinRoom', this.room.id);

        console.log('  client %s connected to room %s', this.id, this.room.id);

        // send the configuration to the client
        this.socket.emit('client.init', {
            // client identifier
            id: this.id
            // game configuration
            , canvasWidth: config.canvasWidth
            , canvasHeight: config.canvasHeight
            , gameWidth: config.gameWidth
            , gameHeight: config.gameHeight
            // map configuration
            , mapKey: this.room.tilemap.key
            , mapData: JSON.stringify(require(this.room.tilemap.data))
            , mapType: this.room.tilemap.type
            , mapImage: this.room.tilemap.image
            , mapSrc: this.room.tilemap.src
            , mapLayer: this.room.tilemap.layers[0]
        });

        // bind event handlers
        this.socket.on('client.ready', this.onReady.bind(this));
        this.socket.on('disconnect', this.onDisconnect.bind(this));
    }
    /**
     * Event handler for when this client is ready.
     */
    , onReady: function() {
        var player = EntityFactory.create(this.socket, 'player')
            , id = shortid.generate();

        player.attrs.set({
            id: id
            , clientId: this.id
            // todo: add some logic for where to spawn the player
            // spawn the player at a random location for now
            , x: Math.abs(Math.random() * (config.gameWidth - player.attrs.get('width')))
            , y: Math.abs(Math.random() * (config.gameHeight - player.attrs.get('height')))
        });

        console.log('   player %s created for client %s', player.attrs.get('id'), this.id);

        this.socket.emit('player.create', player.serialize());

        this.room.entities.add(id, player);

        // bind event handlers
        this.socket.on('player.state', this.onPlayerState.bind(this));

        this.player = player;
    }
    /**
     * Synchronizes this client with the server.
     * @param {object} state state to synchronize
     */
    , sync: function(state) {
        this.socket.emit('client.sync', state);
    }
    /**
     * Event handler for when an entity is updated.
     * @param {object} state player state
     */
    , onPlayerState: function(state) {
        this.player.state.push(state);
    }
    /**
     * Event handler for when this client disconnects.
     */
    , onDisconnect: function() {
        // remove the player
        this.player.die();

        // let other clients know that this client has left the room
        this.socket.broadcast.emit('player.leave', this.player.attrs.get('id'));

        console.log('  client %s disconnected from room %s', this.id, this.room.id);
        this.trigger('client.disconnect', [this]);
    }
});

module.exports = Client;