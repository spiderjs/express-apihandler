import { only, skip, slow, suite, test, timeout } from 'mocha-typescript';
import rx = require('rx');
import log4js = require('log4js');
import assert = require('assert');
import express = require('express');
import bodyParser = require('body-parser');
import request = require('request');
import apihandler = require('apihandler');
import expressapi = require('../src');

const logger = log4js.getLogger('test');

const app = express();

const loader = new apihandler.ConfigFileLoader();
const context = new apihandler.Context(loader);

class Test {
    public getHello(a: number, b: number) {
        return rx.Observable.from([a, b]);
    }

    public postHello(a: number, b: number) {
        return rx.Observable.from([a, b]);
    }

};

context.bind('test', new Test());

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressapi.expressHandler(context, () => { }));
app.listen(8081, () => {
    logger.debug('listen on 8081');
});

// tslint:disable-next-line:max-classes-per-file
@suite('express apihandler test')
class ExpressAPIHandlerTest {

    @test('get test')
    public getTest(done: any) {
        request.get({
            url: 'http://localhost:8081/test/hello?a=1&b=2',
        }, (error, response, body) => {
            if (error) {
                logger.error(error);
                done(error);
                return;
            }
            logger.debug(body);
            if (response) {
                if (response.statusCode !== 200) {
                    done(new Error(response.statusMessage));
                } else {
                    done();
                }
            }
        });
    }

    @test('post test')
    public postTest(done: any) {
        request.post({
            body: {
                a: 1,
                b: 2,
            },
            json: true,
            url: 'http://localhost:8081/test/hello',
        }, (error, response, body) => {
            if (error) {
                logger.error(error);
                done(error);
                return;
            }
            logger.debug(body);
            if (response) {
                if (response.statusCode !== 200) {
                    done(new Error(response.statusMessage));
                } else {
                    done();
                }
            }
        });
    }
};
