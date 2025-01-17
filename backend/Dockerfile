# the image base: a simple Linux-based image
FROM node:22-alpine
# set our working directory in our image
WORKDIR /app
# copy our package.json which includes our dependencies
COPY package.json .
# install our dependencies
RUN npm install
# copy our actual application code
COPY *.js .
# expose the port on which we run our application
EXPOSE 80
# run the application
CMD ["npm", "start"]