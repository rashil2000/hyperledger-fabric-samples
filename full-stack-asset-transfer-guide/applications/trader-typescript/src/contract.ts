/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { CommitError, Contract, StatusCode } from '@hyperledger/fabric-gateway';
import { TextDecoder } from 'util';

const RETRIES = 2;

const utf8Decoder = new TextDecoder();

export interface Asset {
    ID: string;
    Color: string;
    Size: number;
    Owner: string;
    AppraisedValue: number;
}

export type AssetCreate = Omit<Asset, 'Owner'> & Partial<Asset>;
export type AssetUpdate = Pick<Asset, 'ID'> & Partial<Omit<Asset, 'Owner'>>;

/**
 * AssetTransfer presents the smart contract in a form appropriate to the business application. Internally it uses the
 * Fabric Gateway client API to invoke transaction functions, and deals with the translation between the business
 * application and API representation of parameters and return values.
 */
export class AssetTransfer {
    readonly #contract: Contract;

    constructor(contract: Contract) {
        this.#contract = contract;
    }

    async addClient(initAmount: number): Promise<void> {
        await this.#contract.submit('AddClient', {
            arguments: [initAmount.toString()],
        });
    }

    async getAllTokens(): Promise<{ id: string, tokens: number }[]> {
        const result = await this.#contract.evaluate('GetAllTokens');
        if (result.length === 0) {
            return [];
        }

        return JSON.parse(utf8Decoder.decode(result)) as { id: string, tokens: number }[];
    }

    async getTokens(): Promise<number> {
        const result = await this.#contract.evaluate('GetTokens');
        return JSON.parse(utf8Decoder.decode(result)) as number;
    }

    async putTokens(newAmount: number): Promise<void> {
        await submitWithRetry(() => this.#contract.submit('PutTokens', {
            arguments: [newAmount.toString()],
        }));
    }

    async deleteClient(): Promise<void> {
        await submitWithRetry(() => this.#contract.submit('DeleteClient'));
    }

    async clientExists(): Promise<boolean> {
        const result = await this.#contract.evaluate('ClientExists');
        return utf8Decoder.decode(result).toLowerCase() === 'true';
    }

    async contributeResource(data: string): Promise<void> {
        await this.#contract.submit('ContributeResource', {
            arguments: [data],
        });
    }

    async consumeResource(requiredLength: number): Promise<void> {
        await this.#contract.submit('ConsumeResource', {
            arguments: [requiredLength.toString()],
        });
    }
}

async function submitWithRetry<T>(submit: () => Promise<T>): Promise<T> {
    let lastError: unknown | undefined;

    for (let retryCount = 0; retryCount < RETRIES; retryCount++) {
        try {
            return await submit();
        } catch (err: unknown) {
            lastError = err;
            if (err instanceof CommitError) {
                // Transaction failed validation and did not update the ledger. Handle specific transaction validation codes.
                if (err.code === StatusCode.MVCC_READ_CONFLICT) {
                    continue; // Retry
                }
            }
            break; // Failure -- don't retry
        }
    }

    throw lastError;
}
