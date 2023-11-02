export type TokenData = {
    hash: string;
    tokenId: string;
};

export function genTokenData(projectNum: number): TokenData {
    const data: TokenData = { 'hash': '', 'tokenId': '' };
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
        hash += Math.floor(Math.random() * 16).toString(16);
    }
    data.hash = hash;
    data.tokenId = (projectNum * 1000000 + Math.floor(Math.random() * 1000)).toString();
    return data;
}
