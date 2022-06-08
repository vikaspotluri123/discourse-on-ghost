import type {Request, Response} from 'express';

export function sayHello(_: Request, response: Response) {
	response.send('Hello, World!');
}
