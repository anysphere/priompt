/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

export function getTokenizer(): Tokenizer
export class Tokenizer {
  exactNumTokensCl100KNoSpecialTokens(text: string): Promise<number>
  encodeCl100KNoSpecialTokens(text: string): Promise<Array<number>>
  decodeCl100K(encodedTokens: Array<number>): Promise<string>
}