import apihandler = require('apihandler');
import express = require('express');
import passport = require('passport');
import log4js = require('log4js');
const logger = log4js.getLogger('express-apihandler');

function isEmpty(obj: any) {
    for (const name in obj) {
        if (obj[name]) {
            return false;
        }

    }
    return true;
};

function docall(name: string, context: apihandler.IContext, req: express.Request, res: express.Response) {
    logger.debug(`params: ${JSON.stringify(req.params)}`);
    logger.debug(`query: ${JSON.stringify(req.query)}`);
    logger.debug(`body: ${JSON.stringify(req.body)}`);

    let params = req.params;

    if (isEmpty(params)) {
        params = req.query;
    }

    if (isEmpty(params) && req.body) {
        params = req.body;
    }

    logger.debug(`api params: ${JSON.stringify(params)}`);

    context.call({
        name,
        params,
        user: req.user,
    }).reduce((list: any[], item: any) => {
        list.push(item);
        return list;
    }, []).subscribe((result: any) => {
        if (result.length === 1) {
            res.status(200).json({
                code: 'SUCCESS',
                data: result[0],
            });
        } else if (result.length === 0) {
            res.status(404).json({
                code: 'RESOURCE_NOT_FOUND',
                errmsg: `resource not found`,
            });
        } else {
            res.status(200).json({
                code: 'SUCCESS',
                data: result,
            });
        }
    }, (error) => {

        logger.error(`call method[${name}] -- failed`, error);

        if (!error.code) {
            res.status(500).json({
                code: 'INNER_ERROR',
                errmsg: error.toString(),
            });

            return;
        }

        res.status(400).json({
            code: error.code,
            errmsg: error.errmsg,
        });

    });
}

export function expressHandler(context: apihandler.IContext, auth: express.Handler): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {

        const name = `${req.method} ${req.path}`;
        logger.debug(`method: ${name}`);

        context.getLoader().get(name).subscribe((c) => {

            if (c.auth) {
                auth(req, res, (err) => {
                    if (err) {
                        logger.error(`call method[${name}] -- failed`, err);
                        if (!err.code) {

                            res.status(500).json({
                                code: 'INNER_ERROR',
                                errmsg: err.toString(),
                            });

                            return;
                        }

                        res.status(400).json({
                            code: err.code,
                            errmsg: err.errmsg,
                        });
                        return;
                    }

                    docall(name, context, req, res);
                });
            } else {
                docall(name, context, req, res);
            }

        }, (error) => {
            if (error.code === 'RESOURCE_NOT_FOUND') {
                next();
                return;
            }

            logger.error(`call method[${name}] -- failed`, error);

            res.status(200).json({
                code: error.code ? error.code : 'INNER_ERROR',
                errmsg: error.errmsg ? error.errmsg : error.toString(),
            });
        });
    };
}


