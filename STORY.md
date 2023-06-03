Is poker a game of skill? Certainly it's a better game than chess for average people, because you can blame your losses on luck and get away with it. But what if you want to improve and get really good? Let's calculate that using a simulation.

I love chess and lichess. And I've always wanted a similar platform for poker. Poker but without the gambling and money. Just for viewing your stats and measuring your skill. My main concern is to draw attention and get people to actually spend their time on this poker site without actually gambling for money. My other concern is poker sites are illegal in my country.

One solution to draw attention is building an AI so it can play with the few people interested in the site to keep them entertained. In this article, I discuss my journey building a poker site, a poker playing AI using neural networks, and dealing with various challenges along the way.

In the past, I've studied how [lc0](https://lczero.org/) works, but never fully understood how the training data, weights of the network transferred between different systems and assembled. The C++ code was not implemented for tensorflow backend. Currently it is implemented, and now I have a more clear picture of how it works. 

lc0 is an open source chess engine that uses Monte Carlo Tree Search and neural networks. 
