---
title: Concurrency safe file access in Go
date: 2021-01-18
categories:
-  go
---

Using a file for persistent storage (and not a database - datastore/object store) sounds like an academic exercise.
For me, it brings back memories of writing a structure in C (programming language) to a file to simulate
a student record database. However, there may be situations where you may just get by using it especially
when you just want to run a single copy of your application. 

Let's see a pattern for implementing concurrency safe file access in Go using `sync.Mutex`. 

# Our data structure

Let's consider the following `struct` type:

```
type fileStore struct {
	Mu    *sync.Mutex
	Store map[string]string `json:"store"`
}
```

Our data store here is the `Store` map object. This is what we will read from the file and write to the file.
At any point of time our application is running, the `Store` object must be strongly consistent with what's inside
the file. Of course, the application may be killed or crash between updating the map and writing to file which doesn't
help with our consistency goal, but let's ignore that for now.

The `sync.Mutex` object, `Mu` is our guardrail here. It is our mechanism here to ensure that:

1. Only one goroutine is ever reading or writing to `Store` object
2. Only one goroutine is ever populating the `Store` object from the file
3. Only one goroutine is ever persisting the `Store` object to the file

You have already realized that I am going to be persisting the `map` object as a JSON encoded object in the file.
Of course, you could choose any other object type to persist, any other encoding mechanism instead of JSON, or
a combination of the two. The implementation will vary then, but hopefully the ideas are transferable.

# A reference implementation

We will create a new package to encapsulate all the file operations:

```
package filestore

// imports


// Our data structure that we will persist is guarded with
// a Mutex object
type fileStore struct {
	Mu    *sync.Mutex
	Store map[string]string `json:"store"`
}

// FileStoreConfig encapsulates the DataFileName and
// the fileStore object
var FileStoreConfig struct {
	DataFileName string
	Fs           fileStore
}
```

Having defined the above types, we can write an `Init()` function which will take the file
path as a parameter, create the file if it doesn't exist and returns a `FileStoreConfig` object
which the rest of the application can use:

```
// Init creates the file if it doesn't exist and initializes the  FileStoreConfig
// to be used in the rest of the application
func Init(dataFileName string) error {
	_, err := os.Stat(dataFileName)

	if err != nil {
		_, err := os.Create(dataFileName)
		if err != nil {
			return err
		}
	}
	FileStoreConfig.Fs = fileStore{Mu: &sync.Mutex{}, Store: make(map[string]string)}
	FileStoreConfig.DataFileName = dataFileName
	return nil
}

```
The `Init()` function is called at application startup.

Once that's done, the rest of the application then interacts with two methods implemented for
the `fileStore` object:

- Write() 
- Read()

For the purpose of this reference implementation, we will consider another struct type:

```
type myDataType struct {
    Key string
    Value string
}
```

This type will encapsulate a single data item we may want to read or write from the map, `Store`.

## Writing to the file

The `Write()` function is called with an object of `myDataType` which contains
both the key and value to store in the map and looks like this:

```
func (j fileStore) Write(data myDataType) error {
	j.Mu.Lock()
	defer j.Mu.Unlock()

	err := j.ReadFromFile()
	if err != nil {
		return err
	}
	j.Store[data.Key] = data.Value
	return j.WriteToFile()
}
```

The `Write()` function updates the `Store` map object and then uses a helper function, `writeToFile()` 
which looks like this:

```
func (j fileStore) WriteToFile() error {
	var f *os.File
	jsonData, err := json.Marshal(j.Store)
	if err != nil {
		return err
	}
	f, err = os.Create(FileStoreConfig.DataFileName)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write(jsonData)
	return err
}

```

The `WriteToFile()` function essentially writes the `Store` object to disk. It's worth
noting here that the `os.Create()` function will truncate the file if it exists. This
is exactly what we want here as we are writing the complete `Store` object every time.

You can see that by using the `sync.Mutex` object:

1. Only one goroutine is ever reading or writing to `Store` object
2. Only one goroutine is ever persisting the `Store` object to the file

If we have another goroutine attempting to get a lock to write to the file, it will block
till the previous goroutine has released the lock.


## Reading from file

The `Read()` function accepts a key, `id` whose value we are interested in. Recall that our key object here
is a `map[string]string`

```
func (j fileStore) Read(id string) (string, error) {
	j.Mu.Lock()
	defer j.Mu.Unlock()

	err := j.ReadFromFile()
	if err != nil {
		return "", err
	}

	data := j.Store[id]
	delete(j.Store, id)
	j.WriteToFile()

	return data, nil
}
```

The helper function, `ReadFromFile()`, like its counterpart, `WriteToFile()` reads the complete file
and overwrites the current `Store` object in memory:

```
func (j fileStore) ReadFromFile() error {

	f, err := os.Open(FileStoreConfig.DataFileName)
	if err != nil {
		return err
	}
	jsonData, err := ioutil.ReadAll(f)
	if err != nil {
		log.Fatal(err)
	}
	if len(jsonData) != 0 {
		return json.Unmarshal(jsonData, &j.Store)
	}
	return nil
}
```

# Notes

It's worth noting though that in the `WriteToFile()` function, truncation operation removes the old file before creating
the new one. Hence if the application is killed in the window between the removal and the creation, we have lost
all the data. So we can improve upon this by using a `rename()` operation instead.


# Learn more

- An introduction to [sync.Mutex](https://tour.golang.org/concurrency/9)
- [Tailscale - An unlikely database migration](https://tailscale.com/blog/an-unlikely-database-migration/)
- For an alternative to using `sync.Mutex`, see [this post](https://blog.gopheracademy.com/advent-2014/safe-json-file-db-in-go/)
