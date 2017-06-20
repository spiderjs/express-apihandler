import Rx = require('rx');
import redis = require('redis');
import config = require('config');
import logger = require('log4js');
import jwt = require('passport-jwt');
import snowflake = require('snowflake-idgen');
import jsonwebtoken = require('jsonwebtoken');

const log = logger.getLogger('jwtredis');
export interface IJWTRedisConfig {
    secret: string;
    options?: redis.ClientOpts;
    timeout: number; // the seconds of session timeout
}

export class JWTRedis {
    private client: redis.RedisClient;
    private config: IJWTRedisConfig;
    private snowflake: snowflake.SnowFlake;
    constructor(configname?: string) {

        this.config = config.get<IJWTRedisConfig>(configname ? configname : 'jwt-redis');

        this.client = redis.createClient(this.config.options);

        this.client.on('error', (error: Error) => {
            log.error('', error.stack);
        });

        this.snowflake = new snowflake.SnowFlake(config.get<number>('nodeid'));
    }

    public createToken<T>(key: string, user: T, sessionKey?: string): Rx.Observable<string> {
        const oid = sessionKey ? sessionKey : this.snowflake.newoid('JWTREDIS');
        const token = jsonwebtoken.sign({
            sub: oid,
            key,
        }, this.config.secret);

        log.debug(`create token for ${JSON.stringify(user)}`);

        return Rx.Observable.create<string>((observer) => {
            this.client.set(`${key}`, JSON.stringify({ oid, user }), 'EX', this.config.timeout, (error: any) => {
                if (error) {
                    observer.onError(error);
                    return;
                }

                log.debug(`create token for ${JSON.stringify(user)} -- success ${token}`);
                observer.onNext(token);
                observer.onCompleted();
            });
        });
    }

    public passortStrategy(): jwt.Strategy {
        const ops = {
            jwtFromRequest: jwt.ExtractJwt.fromAuthHeader(),
            secretOrKey: this.config.secret,
        };
        return new jwt.Strategy(ops, (payload: any, done: jwt.VerifiedCallback) => {
            log.debug(`process jwt authenticate :${JSON.stringify(payload)}`);
            this.verify(payload, done);
        });
    }

    private verify(payload: any, done: jwt.VerifiedCallback): void {
        this.client.get(payload.key, (error: any, result: any) => {
            log.debug(`load jwt session:${payload.key} ...`);

            if (error) {
                log.error(`load jwt session:${payload.key} -- error`, error);
                done(error, null);
                return;
            }

            if (!result) {
                log.debug(`load jwt session:${payload.key} -- failed,not found`);
                done(null, null);

                return;
            }

            const token = JSON.parse(result);

            if (!token.oid || token.oid !== payload.sub) {
                log.error(`load jwt session(${payload.key}) -- failed, session id miss match (token.oid,payload.sub)`);
                done(null, null);

                return;
            }

            log.debug(`load jwt session:${payload.key} -- success`, JSON.stringify(token));

            done(null, token.user);
        });
    }
};



