export interface VoteRecord {
  playerId: string;
  voted: boolean;
}

export function countVotes(votes: readonly VoteRecord[]): number {
  return votes.filter((vote) => vote.voted).length;
}
