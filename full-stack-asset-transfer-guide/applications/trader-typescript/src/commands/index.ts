/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Gateway } from '@hyperledger/fabric-gateway';
import add from './add';
import deleteCommand from './delete';
import getAll from './getAll';
import listen from './listen';
import get from './get';
import put from './put';
import exists from './exists';
import contribute from './contribute';
import consume from './consume';

export type Command = (gateway: Gateway, args: string[]) => Promise<void>;

export const commands: Record<string, Command> = {
    add,
    delete: deleteCommand,
    getAll,
    listen,
    get,
    put,
    exists,
    contribute,
    consume,
};
