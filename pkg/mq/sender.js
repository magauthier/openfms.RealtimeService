﻿import amqp from 'amqplib';
import _ from 'lodash';

// https://www.squaremobius.net/amqp.node/channel_api.html#connect
// https://github.com/sergey-suslov/node-rabbitmq-example/blob/master/sender/src/rabbit/index.js
/**
 * @var {Promise<MessageBroker>}
 */
let instance;


class MessageBroker {
    constructor() {
        this.queues = {};
    }

    /**
     * Send message to queue
     * @param {String} queue Queue name
     * @param {Object} msg Message as Buffer
     */
    async init() {
        //this.connection = await amqp.connect('amqp://user:pw@hostname:5672')
        this.connection = await amqp.connect('amqp://openfms:open1qaz@localhost:5672')
        this.channel = await this.connection.createChannel();
              
        return this;
    }

    /**
     * Send message to queue
     * @param {String} queue Queue name
     * @param {Object} msg Message as Buffer
     */
    async send(queue, msg) {
        if (!this.connection) {
            await this.init();
        }
        await this.channel.assertQueue(queue, { durable: true });
        this.channel.sendToQueue(queue, msg);
    }

    /**
       * @param {String} queue Queue name
       * @param {Function} handler Handler that will be invoked with given message and acknowledge function (msg, ack)
       */
    async subscribe(queue, handler) {
        if (!this.connection) {
            await this.init();
        }
        if (this.queues[queue]) {
            const existingHandler = _.find(this.queues[queue], h => h === handler);
            if (existingHandler) {
                return () => this.unsubscribe(queue, existingHandler);
            }
            this.queues[queue].push(handler);
            return () => this.unsubscribe(queue, handler);
        }

        await this.channel.assertQueue(queue, { durable: true });
        this.queues[queue] = [handler];
        this.channel.consume(
            queue,
            async (msg) => {
                const ack = _.once(() => this.channel.ack(msg))
                this.queues[queue].forEach(h => h(msg, ack))
            }
        );
        return () => this.unsubscribe(queue, handler);
    }

    async unsubscribe(queue, handler) {
        _.pull(this.queues[queue], handler);
    }
}

MessageBroker.getInstance = async function () {
    if (!instance) {
        const broker = new MessageBroker();
        instance = broker.init();
    }
    return instance;
}

export default MessageBroker;