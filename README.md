wavelength.

wics26 

## Inspiration
The inspiration was the rise in popularity of various games such as Geo-guesser and Wordle, which were unique pathways that combined learning with gaming. Our group all grew up playing instruments and know first-hand how frustrating it can be to learn music and understand how our individual performance relates to the larger orchestra. The motivation behind our project is to provide that revolutionary format that bridges gaming with learning music composition theory and help people develop their musical intuitions.

## What it does
The way this works is there is a "word bank" of songs the game has access to. It will randomly choose one song, split it into its 6 instrumental parts, and then present those tracks to the user. The user then solves the puzzle of identifying the mysterious song the program chose using the instrumental parts as clues, and they are rewarded with more points if they are able to deduce the song correctly with less clues. This program is an innovative and entertaining way to learn about music composition theory.

## How we built it
We built the frontend using React because it enabled us to dynamically represent data to the users. We also utilized libraries such as Wavesurfer.js and Google Material Design 3 for more elegant methods of visualization. For the backend, we had a FlaskAPI coordinated between Amazon S3 Buckets, Supabase databases, APIs for downloading metadata about songs and splitting them into their instrumental components, and finally embedding clips of song audio data and feeding that into pretrained models.

## Challenges we ran into
We ran into a lot of challenges early on navigating around api limits and being able to wrangle data into formats we could work with. Then, we had to overcome issues with communicating key information between users and the program. Finally, we had lots of issues integrating all of our services together.

## Accomplishments that we're proud of
We are proud of how nuanced our project is. We set a lot of ambitious goals and had to tie together lots of  different services in a short amount of time, most of which we have very limited experience with. Specifically, our group is proud of how we integrated a dynamic React frontend with a Flask backend that had to pull in data from Supabase databases and Amazon SW3 Buckets, as well as how we were able to resourcefully extract all the metadata we required from the songs using APIs.

## What we learned
We learned a lot about processing audio files and using them as inputs for machine learning models. As mentioned above, we had to learn how to use multiple APIs to grab the necessary metadata, using models to embed the audio files of songs, and finally deriving a weighted formula to determine similarity between two songs. Besides the technological expertise we gained, it was cool to learn which factors were the most important for determining similarity between songs, but also how the various instruments used in a song all harmonize together.

## What's next for Wavelength
Given more time, we would like to explore turning this game into a live, competitive match between users.   We believe it would a new and challenging way for users to learn more about the world of composition and music while having lots of fun.
