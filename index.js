const cheerio = require("cheerio");
const Axios = require("axios");
const request = require('request-promise');

// Decks' names
var names = ["majorarcana", "wands", "cups", "swords", "pentacles"]

// Meanings' names
var meanings_names = ['Upright Love Meaning', 'Upright Career Meaning', 'Upright Finances Meaning',
    'Reversed Love Meaning', 'Reversed Career Meaning', 'Reversed Finances Meaning'
];

main();

async function main() {
    // Get decks 
    let data = await getCards().then((value) => { return value })
        // console.log(data[0][0]);

    // Post data on api
    let i = 0;
    data.forEach(deck => {
        // Post decks' names
        let options_deck = {
            headers: {
                'Content-Type': 'application/json'
            },

            body: {
                name: names[i]
            },
            uri: 'http://localhost:8080/decks/',
            json: true
        };
        i++;

        let post_deck = request.post(options_deck).then(res => {

                // Post cards' data
                deck.forEach(card => {

                    // Card data
                    let options_card = {
                        headers: {
                            'Content-Type': 'application/json'
                        },

                        body: {
                            deck: card.deck,
                            name: card.name,
                            img: card.img
                        },
                        uri: 'http://localhost:8080/cards/',
                        json: true
                    };

                    // Post card
                    let post_card = request.post(options_card).then(res_post_card => {

                        // Get card's deck
                        let get_deck_options = {
                            uri: "http://localhost:8080/decks/search/findByName?name=" + card.deck,
                            json: true
                        }

                        let get_deck = request.get(get_deck_options).then(result_card => {
                            // console.log(result_card._embedded.decks[0]);

                            // Add relationship between card and deck
                            if (result_card._embedded.decks.length > 0) {

                                let options_card_deck = {
                                    uri: res_post_card._links.deck.href,
                                    headers: {
                                        'Content-Type': 'text/uri-list'
                                    },
                                    body: result_card._embedded.decks[0]._links.self.href
                                }

                                let put_deck_card = request.put(options_card_deck).then(res => {
                                    // console.log(res);
                                }).catch(err => console.log(err));
                            }

                        }).catch(err => console.log(err))
                    }).then(res => {

                        // Post meanings' data
                        card.meanings.forEach(meaning => {
                            // Meaning data
                            let options_meaning = {
                                headers: {
                                    'Content-Type': 'application/json'
                                },

                                body: {
                                    name: meaning.name,
                                    text: meaning.text
                                },
                                uri: 'http://localhost:8080/meanings',
                                json: true
                            };

                            // Post meaning data
                            let post_data_meaning = request.post(options_meaning).then(res_post_meaning => {

                                    // Get meaning's card
                                    let get_cards_options = {
                                        uri: "http://localhost:8080/cards/search/findByName?name=" + meaning.card,
                                        json: true
                                    }

                                    let get_cards = request.get(get_cards_options).then(result_meaning => {

                                        // Add relationship between meaning and card
                                        if (result_meaning._embedded.cards.length > 0) {
                                            // console.log(res_post_meaning);
                                            let options_meaning_card = {
                                                uri: res_post_meaning._links.cards.href,
                                                headers: {
                                                    'Content-Type': 'text/uri-list'
                                                },
                                                body: result_meaning._embedded.cards[0]._links.self.href
                                            }

                                            let put_card_meaning = request.put(options_meaning_card).then(res => {
                                                // console.log(res);
                                            }).catch(err => console.log(err));
                                        }

                                    }).catch(err => console.log(err))

                                }).catch() //err => console.log(err))
                        });

                    }).catch(err => console.log(err))
                });

            }).catch() //err => console.log(err))
    });

}

// Create the different decks and fill them with cards
// Returns  - List of every deck with their cards filled
async function getCards() {
    var decks = [];
    let final = await (Axios.get("https://labyrinthos.co/blogs/tarot-card-meanings-list").then((response) => {
        const $ = cheerio.load(response.data);
        var selector = $("#PageContainer").html();
        var deck = []
        var card = {}

        // Fill deck with card names and url
        for (let i = 0; i < names.length; i++) {
            deck = [];
            $(selector).find("#" + names[i] + " > div > div").each((index, e) => {
                card = {};
                card.deck = names[i];
                card.path = ($(e).find("h3 > a")).attr("href");
                card.name = (($(e).find("h3 > a")).text()).replace("Meaning", "").trim();

                deck.push(card);
            })
            decks.push(deck);
        }
        return decks;

    })).then(value => { return fillCards(value) }).then((value) => { return value });
    // console.log(final);
    return final;
}

// Fill cards' content
// Returns  - List of every deck with their cards filled
async function fillCards(decks) {
    // Iterate over the cards on each deck
    for (let i = 0; i < decks.length; i++) {
        for (let j = 0; j < decks[i].length; j++) {
            // Fill a card's content
            let card = await fillCard(decks[i][j]);
            // console.log(card);
            // Update the card value on decks
            decks[i][j] = card;
        }
    }
    return decks;
    // console.log(data[0][0]);
};

// Fill a card's content
// Returns - card with path, name, image and meanings
// Structure: {path: -, name: -, img: -, meanings: {card: -, name: -, text: -}}
async function fillCard(card) {
    // Open the card's url
    let final = Axios.get("https://labyrinthos.co" + card.path).then((response) => {
        const $ = cheerio.load(response.data);
        var selector = $("#PageContainer").html();

        // Get the card's image
        card.img = "https:" + $(selector).find("div.rte.rte--indented-images.content > img").attr("src");

        var meanings = []
        var meaning = {}

        meaning.card = card.name;

        // Get meanings of the card
        getMeanings(response)
            .then((meanings_text) => {
                for (let i = 0; i < meanings_names.length; i++) {
                    meaning = {}
                        // Get meaning names from meaning_names variable 
                    meaning.card = card.name;
                    meaning.name = meanings_names[i];
                    meaning.text = meanings_text[i];
                    meanings.push(meaning);
                }
                card.meanings = meanings;
            })
            .catch(e => {
                console.log('There has been a problem with your fetch operation: ' + e.message);
            });

        return (card);
    }).then((value) => { return value })
    return final;
}

// Get a card's meaning
// Returns - meanings array (structure: [meaning 1, meaning 2, ...])
async function getMeanings(response) {
    const $ = cheerio.load(response.data);
    var selector = $("#PageContainer").html();

    var meanings_text = []

    // Select the meaning's tables on the page
    $(selector).find("table").each((index, a) => {
        if (index != 0) {
            ($(a).find("tbody > tr:nth-child(2) > td")).each((index, c) => {
                meanings_text.push(($(c).text()));
            });
        }

    });

    return meanings_text;
}