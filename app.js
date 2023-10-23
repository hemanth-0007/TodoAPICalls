const express = require("express");
const app = express();
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { format } = require("date-fns");
app.use(express.json());

// initializing the database and the server and running the server on the
// localhost
let db = null;
const dbPath = path.join(__dirname, "todoApplication.db");
const initializeDBandServer = async () => {
  try {
    // open method returns a promise object
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    if (db === null) console.log("Not connected to database");
    else console.log("Connected to database");

    // after we receive the db object we start our server
    app.listen(3002, () =>
      console.log("Server Started and Running successfully")
    );
  } catch (error) {
    console.log(`DB error ${error.message}`);
    process.exit(1);
  }
};
//calling the function
initializeDBandServer();

// API-1
app.get("/todos/", async (request, response) => {
  const { status, priority, search_q, category } = request.query;

  let query = "SELECT * FROM todo WHERE 1";
  const params = [];

  if (status) {
    if (["TO DO", "IN PROGRESS", "DONE"].includes(status)) {
      query += " AND status = ?";
      params.push(status);
    } else {
      return response.status(400).json("Invalid Todo Status");
    }
  }

  if (priority) {
    if (["HIGH", "MEDIUM", "LOW"].includes(priority)) {
      query += " AND priority = ?";
      params.push(priority);
    } else {
      return response.status(400).json("Invalid Todo Priority");
    }
  }

  if (search_q) {
    query += " AND todo LIKE ?";
    params.push(`%${search_q}%`);
  }

  if (category) {
    if (["WORK", "HOME", "LEARNING"].includes(category)) {
      query += " AND category = ?";
      params.push(category);
    } else {
      return response.status(400).json("Invalid Todo Category");
    }
  }

  try {
    const todoList = await db.all(query, params);
    response.send(todoList);
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
});

// API-2
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `
    SELECT
      *
    FROM
      todo
    WHERE
      id = ${todoId};`;
  const todoList = await db.get(getTodoQuery);
  response.send(todoList);
});

// API-3
app.get("/agenda/", async (request, response) => {
  const { date } = request.query;
  const formattedDate = format(new Date(date), "yyyy-MM-dd");
  if (!formattedDate || formattedDate === "Invalid Date") {
    return response.status(400).json("Invalid Due Date");
  }
  const rows = await db.all("SELECT * FROM todo WHERE due_date = ?", [
    formattedDate,
  ]);
  response.send(rows);
});

// API 4: Create a new todo
app.post("/todos/", async (request, response) => {
  const { id, todo, category, priority, status, dueDate } = request.body;
  //   const formattedDate = format(new Date(dueDate), 'yyyy-MM-dd');
  //   if (!formattedDate || formattedDate === 'Invalid Date')
  //     return response.status(400).json('Invalid Due Date');

  if (!["TO DO", "IN PROGRESS", "DONE"].includes(status))
    return response.status(400).json("Invalid Todo Status");

  if (!["HIGH", "MEDIUM", "LOW"].includes(priority))
    return response.status(400).json("Invalid Todo Priority");

  if (!["WORK", "HOME", "LEARNING"].includes(category))
    return response.status(400).json("Invalid Todo Category");

  const dbResponse = await db.run(
    "INSERT INTO todo (id, todo, category, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?)",
    [id, todo, category, priority, status, dueDate],
    (err) => {
      if (err) {
        console.error("Error inserting into the database:", err.message);
        response.status(500).json("Internal Server Error");
      } else {
        response.send("Todo Successfully Added ");
      }
    }
  );
  const bookId = dbResponse.lastID;
  response.send({ bookId: bookId });
});

// API 5: Update a specific todo by ID
app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const updateData = request.body; // Request body should contain the fields to update
  const { status, priority, todo, category, dueDate } = updateData;
  if (!updateData) {
    return response
      .status(400)
      .json("Invalid request. Please provide data to update.");
  }

  try {
    // Check if the todo with the given ID exists
    const existingTodo = await db.get("SELECT * FROM todo WHERE id = ?", [
      todoId,
    ]);
    if (!existingTodo) {
      return response.status(404).json("Todo not found");
    }

    // Construct the SQL UPDATE query
    let updateQuery = "UPDATE todo SET ";
    const updateParams = [];

    // Check and add fields to update
    if (status) {
      if (["TO DO", "IN PROGRESS", "DONE"].includes(status)) {
        updateQuery += "status = ?, ";
        updateParams.push(status);
      } else {
        return response.status(400).json("Invalid Todo Status");
      }
    }

    if (priority) {
      if (["HIGH", "MEDIUM", "LOW"].includes(priority)) {
        updateQuery += "priority = ?, ";
        updateParams.push(priority);
      } else {
        return response.status(400).json("Invalid Todo Priority");
      }
    }

    if (todo) {
      updateQuery += "todo = ?, ";
      updateParams.push(todo);
    }

    if (category) {
      if (["WORK", "HOME", "LEARNING"].includes(category)) {
        updateQuery += "category = ?, ";
        updateParams.push(category);
      } else {
        return response.status(400).json("Invalid Todo Category");
      }
    }

    if (dueDate) {
      const formattedDate = format(new Date(dueDate), "yyyy-MM-dd");
      updateQuery += "due_date = ?, ";
      updateParams.push(formattedDate);
    }

    // Remove the trailing comma and space
    updateQuery = updateQuery.slice(0, -2);

    // Add the WHERE clause to specify the todo to update
    updateQuery += " WHERE id = ?";
    updateParams.push(todoId);

    // Execute the update query
    await db.run(updateQuery, updateParams);

    response.json("Todo Updated");
  } catch (error) {
    console.log(error.message);
    response.status(500).json("Internal Server Error");
  }
});

// API 6: Delete a specific todo by ID
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;

  try {
    // Check if the todo with the given ID exists
    const existingTodo = await db.get("SELECT * FROM todo WHERE id = ?", [
      todoId,
    ]);
    if (!existingTodo) {
      return response.status(404).json("Todo not found");
    }

    // Delete the todo with the given ID
    await db.run("DELETE FROM todo WHERE id = ?", [todoId]);
    response.send("Todo Deleted");
  } catch (error) {
    console.log(error.message);
    response.status(500).json("Internal Server Error");
  }
});

module.exports = app;
