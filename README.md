# tornet
Simple implementation of a tor network architecture. Single client, a relay and exit node

I started this project as work for a friend who needed it for school project but it was never submitted. I've decided to post it here so others can contribute and benefit.
FYI, it is a huge work in progress.
The setup is made of 3 independent node projects each representing a node. They all start with a simple
```
npm start
```

# Entry node
The entry node can be duplicated. You have to modify the paramenters in index.js to give unique IP and port. loopback IP addresses can be used in testing phase
For now, it keeps a list of the relays hard-coded. Some form of routing and discovery will be implemented to get and store relays

# Relay Node
The same as above applies to the relay node. This is where you would want to go hard on the duplication since more relays improve simulation.

# Exit node
You can test with one or more exit nodes also

The system only processes text requests very well. You can test with a simple request to a locally hosted nginx or apache server, and then something like Google.

I hope to provide more details on the code, comment and trim it up soon. It is quiet messy currently
