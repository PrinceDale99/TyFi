export declare const pdax: {
    /**
     * Market sell XLM for PHP via PDAX institutional API.
     * @param amountXlm The amount of XLM to sell.
     * @returns The Order ID and expected PHP output.
     */
    sellXLM(amountXlm: number): Promise<{
        orderId: string;
        amountPhp: number;
    }>;
    /**
     * Push PHP to the farmer's registered GCash/Maya/Bank account via InstaPay.
     */
    sweepToFiat(amountPhp: number, farmerAccountId: string): Promise<string>;
};
//# sourceMappingURL=pdax.d.ts.map