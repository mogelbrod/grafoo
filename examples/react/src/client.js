import createGrafooConsumer from "@grafoo/react";
import createClient from "@grafoo/core";

const client = createClient("https://api.graph.cool/simple/v1/cj28ccc28umr50115gjodwzix");

if (process.env.NODE_ENV !== "production") window.client = client;

const Consumer = createGrafooConsumer(client);

export default Consumer;
