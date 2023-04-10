/*
 * SPDX-License-Identifier: Apache-2.0
 */

import { Context, Contract, Info, Returns, Transaction } from 'fabric-contract-api';
import { KeyEndorsementPolicy } from 'fabric-shim';
import stringify from 'json-stringify-deterministic'; // Deterministic JSON.stringify()
import sortKeysRecursive from 'sort-keys-recursive';


@Info({title: 'AssetTransfer', description: 'Smart contract for trading assets'})
export class AssetTransferContract extends Contract {
    /**
     * AddClient adds a new client on the ledger, and gives it some introductory amount of tokens.
     */
    @Transaction()
    async AddClient(ctx: Context, id: string, initAmount: number): Promise<void> {
        const exists = await this.ClientExists(ctx, id);
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }

        await ctx.stub.putState(id, Buffer.from(initAmount.toString()));

        await setEndorsingOrgs(ctx, id, ctx.clientIdentity.getMSPID());

        ctx.stub.setEvent('AddClient', Buffer.from(initAmount.toString()));
    }

    /**
     * GetTokens fetches the amount of tokens belonging to the current client.
     */
    @Transaction(false)
    @Returns('number')
    async GetTokens(ctx: Context, id: string): Promise<number> {
        const assetBytes = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetBytes || assetBytes.length === 0) {
            throw new Error(`Sorry, asset ${id} has not been created`);
        }

        return Number(assetBytes);
    }

    /**
     * PutTokens updates the amount of tokens belonging to the current client.
     */
    @Transaction()
    async PutTokens(ctx: Context, id: string, newAmount: number): Promise<void> {
        const exists = await this.ClientExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        await ctx.stub.putState(id, Buffer.from(newAmount.toString()));

        await setEndorsingOrgs(ctx, id, ctx.clientIdentity.getMSPID());

        ctx.stub.setEvent('PutTokens', Buffer.from(newAmount.toString()));
    }

    /**
     * ClientExists returns true when the current client exists in world state; otherwise false.
     */
    @Transaction(false)
    @Returns('boolean')
    async ClientExists(ctx: Context, id: string): Promise<boolean> {
        const tokAmount = await ctx.stub.getState(id);
        return tokAmount?.length > 0;
    }

    /**
     * DeleteClient removes the current client from the ledger
     */
    @Transaction()
    async DeleteClient(ctx: Context, id: string): Promise<void> {
        const assetBytes = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetBytes || assetBytes.length === 0) {
            throw new Error(`Sorry, asset ${id} has not been created`);
        }

        await ctx.stub.deleteState(id);

        ctx.stub.setEvent('DeleteClient', assetBytes);
    }

    /**
     * ContributeResource contributes data to the shared pool.
     * Depending on the amount of data, the client will gain some tokens, and this token value will be updated on the ledger.
     */
    @Transaction()
    async ContributeResource(ctx: Context, id: string, data: string): Promise<void> {
        const exists = await this.ClientExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        const currentTokens = await this.GetTokens(ctx, id);
        const newAmount = currentTokens + evaluateObfuscation(data);

        await this.PutTokens(ctx, id, newAmount);

        ctx.stub.setEvent('ContributeResource', Buffer.from(newAmount.toString()));
    }

    /**
     * ConsumeResource consumes data from the shared pool.
     * Depending on the amount of data, the client will lose some tokens, and this token value will be updated on the ledger.
     * The function will return an error if the client does not have a sufficient amount of tokens.
     */
    @Transaction()
    async ConsumeResource(ctx: Context, id: string, requiredLength: number): Promise<void> {
        const exists = await this.ClientExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        const currentTokens = await this.GetTokens(ctx, id);
        const newAmount = currentTokens - evaluateDeduction(requiredLength);
        if (newAmount < 0) {
            throw new Error(`Client ${id} has insufficient tokens`);
        }

        await this.PutTokens(ctx, id, newAmount);

        ctx.stub.setEvent('ConsumeResource', Buffer.from(newAmount.toString()));
    }

    /**
     * GetAllTokens returns a list of all client-token pairs found in the world state.
     */
    @Transaction(false)
    @Returns('string')
    async GetAllTokens(ctx: Context): Promise<string> {
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');

        const assets: { id: string, tokens: number }[] = [];
        for (let result = await iterator.next(); !result.done; result = await iterator.next()) {
            assets.push({ id: result.value.key, tokens: Number(result.value.value) });
        }

        return Buffer.from(stringify(sortKeysRecursive(assets))).toString();
    }
}

function evaluateObfuscation(data: string): number {
    return Math.ceil(data.length / 10);
}

function evaluateDeduction(requiredLength: number): number {
    return Math.ceil(requiredLength / 10);
}

async function setEndorsingOrgs(ctx: Context, ledgerKey: string, ...orgs: string[]): Promise<void> {
    const policy = newMemberPolicy(...orgs);
    await ctx.stub.setStateValidationParameter(ledgerKey, policy.getPolicy());
}

function newMemberPolicy(...orgs: string[]): KeyEndorsementPolicy {
    const policy = new KeyEndorsementPolicy();
    policy.addOrgs('MEMBER', ...orgs);
    return policy;
}
