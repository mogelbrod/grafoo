import { Authors, Post, Posts, PostsAndAuthors, executeQuery } from "@grafoo/test-utils";
import createCache from "../src";

describe("@grafoo/core", () => {
  it("should be instantiable", () => {
    const cache = createCache();

    expect(typeof cache.listen).toBe("function");
    expect(typeof cache.write).toBe("function");
    expect(typeof cache.read).toBe("function");
    expect(typeof cache.flush).toBe("function");
  });

  it("should write queries to the cache", async () => {
    await mock(PostsAndAuthors, async (cache, data, request) => {
      cache.write(request, data);

      const { authors, posts } = data;
      const { objectsMap, pathsMap } = cache.flush();

      expect(authors).toEqual(
        pathsMap["authors{__typename id name posts{__typename body id title}}"].data.authors
      );
      expect(posts).toEqual(
        pathsMap["posts{__typename author{__typename id name}body id title}"].data.posts
      );
      expect(authors.every(author => Boolean(objectsMap[author.id]))).toBe(true);
      expect(posts.every(post => Boolean(objectsMap[post.id]))).toBe(true);
    });
  });

  it("should read queries from the cache", async () => {
    await mock(Authors, async (cache, data, request) => {
      cache.write(request, data);

      const result = cache.read(request);

      const { authors } = data;

      expect(authors).toEqual(result.data.authors);
      expect(authors.every(author => Boolean(result.objects[author.id]))).toBe(true);
      expect(
        authors.every(author => author.posts.every(post => Boolean(result.objects[post.id])))
      ).toBe(true);
    });
  });

  it("should handle queries with variables", async () => {
    await mock(Post, async (cache, data, request) => {
      cache.write(request, data);

      expect(cache.read({ query: Post, variables: { id: "123" } })).toEqual({});
      expect(cache.read(request).data.post.id).toBe(request.variables.id);
    });
  });

  it("should perform update to cache", async () => {
    await mock(Post, async (cache, data, request) => {
      cache.write(request, data);

      const {
        data: { post }
      } = cache.read(request);

      expect(post.title).toBe("Quam odit");

      cache.write(request, { post: { ...post, title: "updated title" } });

      expect(cache.read(request).data.post.title).toBe("updated title");
    });
  });

  it("should reflect updates on queries with shared objects", async () => {
    await mock([Posts, Post], async (cache, [ostsData, postData], [postsRequest, postRequest]) => {
      cache.write(postsRequest, ostsData);

      const { posts } = cache.read(postsRequest).data;

      expect(posts.find(p => p.id === postsRequest.variables.id).title).toBe("Quam odit");

      cache.write(postRequest, {
        post: { ...postData.post, title: "updated title" }
      });

      const { posts: updatedPosts } = cache.read(postsRequest).data;

      expect(updatedPosts.find(p => p.id === postsRequest.variables.id).title).toBe(
        "updated title"
      );
    });
  });

  it("should merge objects in the cache when removing or adding properties", async () => {
    await mock(Post, async (cache, data, request) => {
      cache.write(request, data);

      const post = JSON.parse(JSON.stringify(cache.read(request).data.post));

      delete post.__typename;

      post.foo = "bar";

      cache.write(request, { post });

      expect(cache.read(request, true).data.post).toEqual({
        __typename: "Post",
        author: {
          __typename: "Author",
          id: "a1d3a2bc-e503-4640-9178-23cbd36b542c",
          name: "Murphy Abshire"
        },
        body: "Ducimus harum delectus consectetur.",
        id: "2c969ce7-02ae-42b1-a94d-7d0a38804c85",
        title: "Quam odit",
        foo: "bar"
      });
    });
  });

  it("should call cache listeners on write with paths objects as arguments", async () => {
    await mock(Post, async (cache, data, request) => {
      const listener = jest.fn();
      const listener2 = jest.fn();

      const unlisten = cache.listen(listener);
      cache.listen(listener2);

      cache.write(request, data);

      expect(listener).toHaveBeenCalledWith(cache.read(request).objects);

      unlisten();
      cache.write(request, data);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(2);

      unlisten();
      cache.write(request, data);

      expect(listener2).toHaveBeenCalledTimes(3);
    });
  });

  it("should be able read from the cache with a declared initialState", async () => {
    await mock(Authors, async (cache, data, request) => {
      cache.write(request, data);

      cache = createCache({ initialState: cache.flush() });

      expect(cache.read(request).data).toEqual(data);
    });
  });

  it("should accept `idFields` array in options", async () => {
    await mock(Authors, async (_, data, request) => {
      const cache = createCache({ idFields: ["__typename", "id"] });

      cache.write(request, data);

      expect(Object.keys(cache.flush().objectsMap).every(key => /(Post|Author)/.test(key))).toBe(
        true
      );
    });
  });
});

async function mock(...args) {
  // tslint:disable-next-line prefer-const
  let [sources, variables, fn] = args;
  const { query } = sources;
  const cache = createCache();
  let results;
  let requests;

  if (args.length < 3) {
    fn = variables;
    // default post id
    variables = { id: "2c969ce7-02ae-42b1-a94d-7d0a38804c85" };
  }

  if (Array.isArray(sources)) {
    requests = sources.map(query => ({ query, variables }));
    results = (await Promise.all(
      sources.map(({ query }) => executeQuery({ query, variables }))
    )).map(_ => _.data);
  } else {
    requests = { query: sources, variables };
    results = (await executeQuery({ query, variables })).data;
  }

  await fn(cache, results, requests);
}
