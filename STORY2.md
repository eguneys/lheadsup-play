## Review 

In our [first article](STORY.md) we have introduced our journey to an advanced Poker AI, by asking if Poker is a game of skill? We mentioned our interest in chess and lichess as an open platform and building a similar site for poker. Then, mentioned how [lc0](https://lczero.org/) chess engine can guide us through building an advanced Poker AI using reinforcement learning.

Next we built a poker logic, and a naive way to evaluate poker hands.

Next we tried to set a baseline for measuring the skill, by building a Texas Hold'em Headsup Poker Tournament. We established poker players that use simple strategies like always folding, always calling, or always raising. Then we setup a benchmark to measure and display some statistics of the tournament.

Next we discussed our first attempt at building a Poker AI using Monte Carlo Tree Search with the help of ChatGPT. And our concerns about how to evaluate the terminal situation of a poker round.

Finally we mentioned the performance bottleneck of calculating the hand strengths of a player at various stages of a poker round. Then we entered the area of neural networks by introducing two warmup tasks that would ease this bottleneck.

## Refining and Optimizing Previous Methods

Last time we built a neural network that can evaluate the hand strength of a player using 2 cards in hand and the board cards. Our next iteration started with integrating this into our MCTS algorithm that searches for optimal play by evaluating the terminal states of a poker round.

The neural network returns the output asynchronously, so we have to consider that. Also it can take input in batches. Which would potentially be faster if we send a batch of input instead of asking one by one.

I know that lc0 code uses multithreading, and it has a concept of `GatherMiniBatch`, which is probably meaning it gathers a batch of input to evaluate for it's neural network. But I have a few questions, and I can't fully decipher the algorithm as there are a few other concepts I don't know about.

The main problem is, If I were to select multiple leaves to evaluate, the UCB formula would select the same leaf every time. To reiterate, leaves are selected, which they have no children, because only terminal states are sent for evaluation that is only leaves, starting from the root, going to a leaf, at each node along the way an UCB formula is used to select which child node to select. These are well explained in my continued discussion about the MCTS with ChatGPT, which there is a link [below](). That is the continuation of my previous discussion so it has more content, but you can skip the first parts.

# Interesting ChatGPT Conversations

[MCTS continued discussion about batching, and backpropagation](https://chat.openai.com/share/d287c5d9-5060-4562-8ebd-653e4fc37cdd)

## Support

Please share your comments and suggestions here.
Don't forget to follow this repo for news and updates on future progress.
If you would like to donate, here's my [buy me a coffee](https://www.buymeacoffee.com/eguneys)
