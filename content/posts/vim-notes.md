---
title:  Notes on Vim
date:  2018-01-05
category: software
---


# Modes

- Insert Normal mode: In insert mode, press `Ctrl-o` to quickly execute a command and come back to insert mode

# Files

- Save current buffer as `file.txt`: `:sav file.text`. If you use `:w` to write the current buffer contents into a new file, post-write, you will still be editing the current buffer



# Opening commands

- `+NUM`: File will be opened and cursor positioned on line, NUM
- `+/{pattern}`: File will be opened and cursor positioned on first occurence of `pattern`
- `+"NUMd|x"` : Delete a specific line from the file



# Cursor movement

- Move to the line below: `j`
- Move the line above: `k`
- Move to the character on the right: `l`
- Move to the character on the left: `h`
- Move forward to the start of the next word: `w`
- Move forward to the end of the next word: `e`
- Move backward to the start of the previous word: `b`
- Move backward to the end of the previous word: `ge`
- Jump to the beginning of a line: `0`
- Jump the end of a line: `$`


# Line search

`f<c>` to go the next occurence of `c`, `;` to repeat this search, `,` to repeat the search in backward direction
`F<c>` to go the previous occurence of `c`, `;` to repeat this search, `,` to repeat the search in forward direction

# Replacing a word in a block

- Go the beginning of a word in the block
- Press `Ctrl+v`, select the word
- Select all the words using down arrow
- `c`, type in the new word, `esc`


# Changing a word at n positions

- Search for the word
- `cgn` - change it
- Press the `.` key to change the next, `n` to skip it

# Recording and playing macros

- Start macro recording: `q<key>` where key is the register you want to store the macro in
- `<perform actions>`. One point to note here is to make your steps so that you start from the beginning of a line.
- Press `q` to save
- To apply the macro on a line: `@<key>`
- To apply the macro to a selection:
  - Visually select the area
  - `:'<,'> normal @<key>`


# Swap two characters

- Place cursor on the first character
- `xp` 
- Learn more: https://stackoverflow.com/questions/1529414/vim-how-do-i-swap-two-characters

# Switch case

- Select the character, word
- Press `~`.

# Replace character

- Select
- `Shift+R`

# Move block of text

- Left: `<<`
- Right: `>>`

# Delete

- Delete till a character on the current line: `dt<character>` 
- Delete current word: `diw`
- Delete text between quotes: `di"`
- Delete all the contents: `gg` to go to the beginning + `dG`
- Delete from current position to the end of line: `d$`
- Delete entire file contents: `:%d`
- Delete current work and enter insert mode: `cw`

# Search

- `*` searches forward for the word under cursor, `#` searches backward for the word under cursor.
- `ggn` - go to the top of the file and find next occurence
- Search history: `/` and type `Ctrl+r`, `ctrl+w` to search in reverse and forward

# Folds

- `set foldmethod=indent`

## Movements

```
zo Open current fold under the cursor.
zc Close current fold under the cursor.
za Toggle current fold under the cursor.
zd Delete fold under the cursor. (only the fold, text is unchanged.)
zj Move the cursor to the next fold.
zk Move the cursor to the previous fold.
zR Open all folds in a current buffer. (Reduce all folds)
zM Close all open folds in a current buffer. (Close more and More folds)
zE Delete all folds the current buffer
:fold In Visual mode: fold selected lines
```

# Powerless verbs

- x - delete character under the cursor to the right
- X - delete character under the cursor to the left
- r - replace character under the cursor with another character
- s- delete character under the cursor and enter the Insert mode


# Miscellaneous movements

- `zz` to center the current line to the center
- `G` to go the last line of the document
- `gg` to go the first line of the document
- `H` to move to the top of the screen
- `M` to move to the middle of the screen
- `L` to move to the bottom of the screen
- Scroll down half page: `Ctrl-d`
- Scroll up half page: `Ctrl-u`
- Scroll down full page: `Ctrl-f`
- Scroll up full page: `Ctrl-b`
- Go to line at 50% of file: `50%`
- In Insert mode, `shift+right/left arrow` to jump forward/backward by words

# External Resources

- [vim tips and tricks](https://www.rosehosting.com/blog/vim-tips-and-tricks/)
- [vi/vim cheat sheet](http://www.viemu.com/vi-vim-cheat-sheet.gif)
- [vim cheat sheet](https://vim.rtorr.com/)
- [Search and Replace](http://vim.wikia.com/wiki/Search_and_replace)
- [Visual block mode](http://vimcasts.org/transcripts/22/en/)
- [Habit breaking, Habit Making](http://vimcasts.org/blog/2013/02/habit-breaking-habit-making/)
- [You don’t need more than one cursor in vim
](https://medium.com/@schtoeffel/you-don-t-need-more-than-one-cursor-in-vim-2c44117d51db)
