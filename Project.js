/* global document, window, Hammer, setTimeout, console */
let wins = 0
let loses = 0;


let startAIFlag = false;
let debugFlag = false;
let movesMade = 0;
var manager = null;

document.addEventListener("DOMContentLoaded", function () {
  // Wait till the browser is ready to render the game (avoids glitches)
  window.requestAnimationFrame(function () {
    manager = new GameManager(4, KeyboardInputManager, HTMLActuator);
    startAI();
  });
});

document.getElementById("AIButton").addEventListener("click", function() {
	//Starts or stops the AI
    startAIFlag = !startAIFlag;
    let message = "";
    if (startAIFlag) {
      message = "Stop AI";
    } else {
      message = "Start AI";
    }
    document.getElementById("AIButton").innerHTML = message;
});

document.getElementById("DebugButton").addEventListener("click", function() {
	//Starts or stops the Debug
    debugFlag = !debugFlag;
    document.getElementById("DebugButton").innerHTML = debugFlag ? "Stop Debug" : "Start Debug";
});

function startAI() {//
	if(startAIFlag) {//Check if AI should run
		manager.grid.score = manager.score //set the score
		manager.move(getBestMove(manager.grid,1));
	}
	if (manager.over) {
		loses += 1;
		debug("Loses went up");
		debug("Games: " + (loses + wins));
		debug("Loses: " + loses);
		debug("Wins: " + wins);
		setTimeout(startAgain, 5000);
	} else if (manager.won) {
		wins += 1;
		debug("Wins went up");
		debug("Games: " + (loses + wins));
		debug("Loses: " + loses);
		debug("Wins: " + wins);
		setTimeout(startAgain, 5000);
	} else {
		let speed = document.getElementById("Speed").value >= 10 ? document.getElementById("Speed").value : 300;
		setTimeout(startAI, speed);
	} //repeats the function for each move
}

function startAgain() {//Repeats the game
	manager.restart();
	setTimeout(startAI,500);
}

function getBestMove(state, lookAheadMoves) {//Takes heuristics and future states into account, and finds the best move
	movesMade = 0;
	let currentMove = 0;
	let bestScore = 0.0;
	let currentScore = 0.0;
	for (let direction = 0; direction < 4; direction++) {
		if (!willMove(state,direction)) {//this direction is a dead end
			if (currentMove == direction) {//ensures the AI doesn't get "stuck" in a move by taking a dead end
				//this typically occurs in a state where any move would result in a game over
				currentMove += 1;
			}
			continue;
		}

		currentScore = 0.0;
		let twosStates = getFuture2s(state, direction);
		for (let st = 0; st < twosStates.length; st++) {
			let theState = twosStates[st];
			let percent = 1.0 / twosStates.length;

			currentScore += percent * getBestScore(theState, lookAheadMoves);
		}
		if (currentScore > bestScore) {
			bestScore = currentScore;
			currentMove = direction;
		}
		debug("States checked: " + movesMade);
	}
	return currentMove;
}

function getBestScore(state, lookAheadMoves) {
	let bestScore = 0.0;
	if (lookAheadMoves > 0) {
		for (let direction = 0; direction < 4; direction++) {
			if (!willMove(state,direction)) {//this direction is a dead end
				continue;
			}
			let currentScore = 0.0;
			let twosStates = getFuture2s(state, direction);
			let percent = 1.0 / twosStates.length;
			for (let sta = 0; sta < twosStates.length; sta++) {
				let theState = twosStates[sta];
				currentScore += percent * getBestScore(theState, lookAheadMoves - 1);
			}
			if (currentScore > bestScore) {
				bestScore = currentScore;
			}
		}
		return bestScore;
	} else {
		movesMade += 1;
		return getScore(state);
	}
}
function cloneGrid(state) {
	let newState = new Grid(4);
	newState.score = state.score;
	for (let thex = 0; thex < newState.cells.length; thex++) {
		for (let they = 0; they < newState.cells[thex].length; they++) {
			if (state.cells[thex][they] != null) {
				newState.cells[thex][they] = new Tile({x: thex,y: they}, state.cells[thex][they].value);
			} else {
				newState.cells[thex][they] = null;
			}
		}
	}
	return newState;
}
function getFuture2s(state, direction) {
	//returns an array of grids for each possible two this state can contain
	let gridArray = [];
	//first, get the state after the move
	let futureState = getFutureState(state, direction);
		if (!futureState.cellsAvailable) {
		//no place for 2s, just return state itself
		gridArray.push(state);
		return gridArray;
	}

	//first get the cells that could get a two
	let cells = futureState.availableCells();
	for (let cell = 0; cell < cells.length; cell++) {
		let newGrid = cloneGrid(futureState);
		let tile = new Tile(cells[cell], 2);
		newGrid.insertTile(tile);
		gridArray.push(newGrid);
	}
	return gridArray;
}

function getScore(state) {
	//grab actual score
	let score = state.score
	//add potential score (if 1048 is next to 1048 that's a really high value potential state)
	for (let x = 0; x < state.size; x++) {
		for (let y = 0; y < state.size; y++) {
			if (state.cellOccupied({x: x, y: y})) {
				let cell = state.cells[x][y];
				let value = cell.value;
				if (value == 2048) {//The mighty 2048 tile
					return 2147483647;
				}
				if (isInEdge(cell)) {
					score += value; //we want high tiles to be on the edges
				}
				while (value > 2) {
					if (isInRange(state,cell,value)) {//we want tiles of similar value next to each other
						score += value //we add by the tile's value so high value tiles have higher weight
					}
					value = value / 2; //we also want tiles whose values are close (example: 512 and 1024)
					//but they are not worth as much
				}
			}
		}
	}
	//ensures highest tile is in corner
	let maxValue = findMaxValue(state);
	if (isInCorner(state, maxValue)) {
		score += 20480; //we want the highest tile to be in the corner
	}
	return score;
}
function isInEdge(cell) {//checks if the cell is on the edge of the grid
	if (cell.x == 0 || cell.y == 0 || cell.x == 3 || cell.y == 3) {
		return true;
	}
	return false;
}
function isInRange(state, cell, mvalue) {//checks if a cell has another cell with mvalue next to it
	for(let dir = 0; dir < 4; dir++) {
		let vector = manager.getVector(dir);
		let newcell = { x: cell.x + vector.x, y: cell.y + vector.y }
		if(state.withinBounds(newcell) && !state.cellAvailable(newcell)) {
			if (state.cellContent(newcell).value == mvalue) {
				return true;
			}
		}
	}
	return false;
}
function isInCorner(state, mvalue) {//checks if mvalue is in a corner
	if (!(state.cells[0][0] === null)) {
		if (state.cells[0][0].value == mvalue) {
			return true;
		}
	} 
	if (!(state.cells[3][0] === null)) {
		if (state.cells[3][0].value == mvalue) {
			return true;
		}
	} 
	if (!(state.cells[0][3] === null)) {
		if (state.cells[0][3].value == mvalue) {
			return true;
		}
	} 
	if (!(state.cells[3][3] === null)) {
		if (state.cells[3][3].value == mvalue) {
			return true;
		}
	} 
	return false;
}
function findMaxValue(state) {//finds the max value in the grid
  let maxValue = 0;
  for (let x = 0; x < state.size; x++) {
    for (let y = 0; y < state.size; y++) {
      if (!(state.cells[x][y] === null)) {
        if (state.cells[x][y].value > maxValue) {
          maxValue = state.cells[x][y].value;
        }		
      }
    }
  }
  return maxValue;
}


function willMove(state,direction) {//checks if the direction will result in a move 
	let otherState = getFutureState(state,direction); //grab the future state of the move
	//check each cell for a difference
	for (let cellx = 0; cellx < state.cells.length; cellx++) {
		for (let celly = 0; celly < state.cells[cellx].length; celly++) {
			if ((state.cells[cellx][celly] == null) != (otherState.cells[cellx][celly] == null)) {
				//one is null, one isn't null
				return true;
			}
			if (state.cells[cellx][celly] == null) {//both null
				continue;
			}
			if (state.cells[cellx][celly].value != otherState.cells[cellx][celly].value) {
				//one cell differs in value from another
				return true;
			}
		}
	}
	return false;
}
function getFutureState(state, direction) {
	//Gets the future state based on the direction
	//this does not add any twos like a normal move would
	if (state.score == -1) {
		//some state in the chain is a dead end, just return current state in that case
		debug(" I DEADENDED");
		return state;
	}
	//first, clone the state so we don't affect the current one
	let newState = cloneGrid(state);
	//next, simulate the move
	// 0: up, 1: right, 2:down, 3: left

  let cell, tile;

  let vector     = manager.getVector(direction);
  let traversals = manager.buildTraversals(vector);
  let moved      = false;

  // Save the current tile positions and remove merger information
  newState.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = newState.cellContent(cell);
      if (tile) {
        let positions = findFarPosition(cell, vector, newState);
		let next      = newState.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value == tile.value && !next.mergedFrom) {
          let merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          newState.insertTile(merged);
          newState.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);
          //tile.x
          // Update the score
          newState.score += merged.value;

          // The mighty 2048 tile
          //if (merged.value === 2048) self.won = true;
        } else {
          newState.cells[tile.x][tile.y] = null;
          newState.cells[positions.farthest.x][positions.farthest.y] = tile;
          tile.updatePosition(positions.farthest);
          //self.moveTile(tile, positions.farthest);
        }

        if (!manager.positionsEqual(cell,tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });
  if (!moved) {
    //dead end, set score to reflect such
    newState.score = -1;
  }
  return newState;
}

function findFarPosition(cell, vector, state) {
  let previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (state.withinBounds(cell) &&
           state.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
}

function debug(message) {
	if (debugFlag) {
		console.log(message);
	}
}