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

The main problem is, If I were to select multiple leaves to evaluate, the UCB formula would select the same leaf every time. To reiterate, leaves are selected, which they have no children, because only terminal states are sent for evaluation that is only leaves, starting from the root, going to a leaf, at each node along the way an UCB formula is used to select which child node to select. These are well explained in my discussion about the MCTS with ChatGPT, which there is a link [below](#interesting-chatgpt-conversations).

So digging deeper, lc0 mentions about a PUCT formula instead of UCB it uses, which reveals things about "Multi-armed Bandits with Episode Context". I gave various links explaining these concepts below. In summary PUCT formula is about adding a policy to node selection formula, in addition to evaluating the value of a node. The policy is the probabilities of each move being played starting from a node. This policy is also trained in the network along with a value for the node. And used for scoring for selecting nodes to visit.

However this doesn't answer how to select multiple leaves for gathering a batch of input. But it led me to this paper I gave a link below, that discusses precisely this problem and gives a full algorithm in addition to mentioning a few terms that englightens the whole idea of how lc0 MCTS works. Terms like "Fpu", and "virtual loss", or as lc0 calls it "N-in-flight".

Gathered with this knowledge, now lc0 C++ code makes way more sense, I get almost the full picture and copied exactly into Javascript code. Yet still there are a few details I have to figure out, which we will deal with later.

Next, another question is, about the point of view for evaluating nodes. Nodes are evaluated using player 1's point of view. Like value is high if terminal state is in player 1's best interest. This leads to a question, alternating nodes select moves for player 1 and player 2. But If I am always evaluating for player 1's best interest, how is player 2 selecting moves that are high for player 1. This discussion is also well explained in my chat with ChatGPT below.

Though I am still not clear, I made a few adjustments, and integrated the async nature of the evaluation algorithm into current MCTS Player. Using the benchmarks and various debugging sessions, it plays way fast for sure. It can also be seen as playing interesting by calling, raising folding etc. But I am not sure if the algorithm is working as expected. I used debugging on lc0 C++ code to figure out how the values change, but I have to investigate further. Let's set this aside though.

Next, looking at the stats, for example winning results, MCTS is not worse, but it's at most even. But I need to get a better picture of how it's playing, so I figured out a way to better extract statistics from a tournament session. There are 4 categories a state of poker round has. 
- An action like, fold, check, raise, call
- The hand strength like, low, medium, high, nuts
- The street like preflop, flop, turn, or river
- And the round result like fold win, fold loss, showdown win or showdown loss.

So I gather a stream of round states sampled at every state change. And put a range of these states at an item for each category. Like from states 2 to 6 it's preflop, or also low hand strength, since hand strengths only change at each street. I can also compose these items from different categories and query for a specific situations like this:

`fwin`, `nuts_sloss`, `low_swin`, `low_fwin`, meaning `fold win`, `showdown loss with nuts`, `swowdown win with a low hand`, `fold win with a low hand`. Or more advanced queries like this:

- `call_med_sloss_river` Call with a medium hand at river resulting in a showdown loss
- `raise_low+med_s_preflop+river` Raise with a low or medium hand at preflop or river resulting in showdown
- `raise_low+med_fwin_preflop+river` etc.

This is exciting and more fun, and can be potentially improved, but I need useful statistics and meaningful results for these metrics.

For example, looking at these statistics, I noticed it gives false positives for considering mediocre hands as nuts. So I turn on to fundamentals and re-evaluate our methods.

### A Better Hand Evaluation Algorithm

Stumbled upon an algorithm [by Cactus](http://suffe.cool/poker/evaluator.html) for 5 hand evaluation, and later a better one called [Two Plus Two](https://www.codingthewheel.com/archives/poker-hand-evaluator-roundup/) for 5, 6, and 7 hands which significantly improved and evaporated our performance problems once and for all, while putting our neural network efforts obselete.

# Interesting ChatGPT Conversations

- [MCTS continued discussion about batching, and backpropagation](https://chat.openai.com/share/4ebf290b-bd22-4b6f-9813-72493055c887)
- [A comprehensive paper about batching in MCTS](https://ludii.games/citations/ARXIV2021-1.pdf)
- [lc0 mentions PUCT from Multi-armed Bandits with Episode Context](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.172.9450&rep=rep1&type=pdf)
- [Blog article about Multi-armed Bandits and Exploration Strategies with example code in gist.](https://sudeepraja.github.io/Bandits/)
- [lc0 mentions AGZ paper](https://www.deepmind.com/blog/alphago-zero-starting-from-scratch)

- [Cactus 5-Hand Poker Hand Evaluation](http://suffe.cool/poker/evaluator.html)
- [The Two Plus Two Poker Hand Evaluation for 5 6 and 7 cards](https://www.codingthewheel.com/archives/poker-hand-evaluator-roundup/)

## Support

Please share your comments and suggestions here.
Don't forget to follow this repo for news and updates on future progress.
If you would like to donate, here's my [buy me a coffee](https://www.buymeacoffee.com/eguneys)
