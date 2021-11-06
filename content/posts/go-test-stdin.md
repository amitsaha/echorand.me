---
title:  The "go test" command, os.Stdin and testing interactive input
date: 2021-11-06
categories:
-  go
---

While working on the solutions to exercises for my soon to be published book [Practical Go](https://practicalgobook.net/), 
I wanted to write a test function which would simulate a user *not* providing an interactive input when one was asked for. 
However, I noticed that the test function would not wait for me to provide the input and just continue the execution. 
Consider the following test function:

```go
import (
        "bufio"
        "fmt"
        "os"
        "testing"
)

func TestInput(t *testing.T) {
        scanner := bufio.NewScanner(os.Stdin)
        msg := "Your name please? Press the Enter key when done"
        fmt.Fprintln(os.Stdout, msg)

        scanner.Scan()
        if err := scanner.Err(); err != nil {
                t.Fatal(err)
        }
        name := scanner.Text()
        if len(name) == 0 {
                t.Log("empty input")
        }
        t.Logf("You entered: %s\n", name)

}
```

The key point is the `scanner := bufio.NewScanner(os.Stdin)` statement. Here I am creating a new Scanner to read
from the standard input, typically, your keyboard.

If you run the above function ([Playground Link](https://play.golang.org/p/-8VayZKyaHY)) via `go test -v`, the test function will
terminate with:

```
=== RUN   TestInput
Your name please? Press the Enter key when done
    prog.go:21: empty input
    prog.go:23: You entered: 
--- PASS: TestInput (0.00s)
PASS
```

Now, instead of running the above test via `go test`, if you compile the test and then run the test executable, it will wait for interactive input.
Try it.

So, I reasoned that there is something special going on in how `go test` runs the test function. At this point of time in my Go learning
journey, I know that `go test` essentially executes the test executable via facilities provided by the [os/exec](https://pkg.go.dev/os/exec)
package. I tried to look [a bit](https://github.com/golang/go/blob/c7f2f51fed15b410dea5f608420858b401887d0a/src/cmd/go/internal/test/test.go) into it, 
but didn't find any quick answers. 

So, I posted my findings to the [golang-nuts google group](https://groups.google.com/g/golang-nuts/c/24pL7iQbx64/m/ZHQugkOLAgAJ).

## Why does it not wait?

As you can see from the reply, the reason the test doesn't wait for the interactive input is the Stdin of the process
that's executed (our test binary), is set to the operating system's null input device (`/dev/null` on [Unix](https://cs.opensource.google/go/go/+/refs/tags/go1.17.3:src/os/file_unix.go;l=202)
and `NUL` on [Windows](https://cs.opensource.google/go/go/+/refs/tags/go1.17.3:src/os/file_windows.go;l=98)).

The top reason I was confused by this is if I had tried something similar in Python, it would have exhibited the expected behavior, i.e. 
the executed program (for e.g. via `subprocess.check_output()`) would have waited for the input. That is because, by default, the
standard input of the newly executed child process is set to [PIPE](https://docs.python.org/3/library/subprocess.html#subprocess.PIPE) 
which is connected to the standard input stream.

## Testing interactive input

So, coming back to my original problem i.e. to simulate that interactive input is *not* provided, this is how I ended
up doing it:

```go
package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"testing"
)

func TestInput(t *testing.T) {
	r, _ := io.Pipe()
	scanner := bufio.NewScanner(r)
	msg := "Your name please? Press the Enter key when done"
	fmt.Fprintln(os.Stdout, msg)

	scanner.Scan()
	if err := scanner.Err(); err != nil {
		t.Fatal(err)
	}
	name := scanner.Text()
	if len(name) == 0 {
		t.Log("empty input")
	}
	t.Logf("You entered: %s\n", name)
}
```

The key here is the call to the [io.Pipe()](https://pkg.go.dev/io#Pipe) function. It returns a reader and a writer. I discard the writer, and use the reader
to create the Scanner object. Now, it will wait for the interactive input. [Go Playground link](https://play.golang.org/p/h3_CPMDplJv).
(I am not sure how the playground detects it so quickly and terminates the test). If you run it on your computer, it will wait for
the input.


## Conclusion

Hope you find the post useful. It certainly stumped me to see this behaviour. For completion, here's how you would simulate interactive input - 
that is where you want to pretend that a user entered a specific input interactively:

```go
input := strings.NewReader("jane")
scanner := bufio.NewScanner(input)
```

The key here is the [strings.NewReader()](https://pkg.go.dev/strings#NewReader) function.
